<?php
declare(strict_types=1);

/**
 * Agent AI Property Advisor
 *
 * Matching is deterministic and database-first. An optional OpenAI Responses API
 * call only turns the ranked matches into a concise agent brief. If no API key is
 * configured, or the provider is unavailable, the ranked advisor remains fully usable.
 */

function ensureAiAdvisorSchema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS ai_advisor_sessions (
        advisor_session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        admin_id INT UNSIGNED NOT NULL,
        agent_id INT UNSIGNED DEFAULT NULL,
        client_name VARCHAR(160) DEFAULT NULL,
        criteria_json LONGTEXT NOT NULL,
        results_json LONGTEXT NOT NULL,
        provider VARCHAR(40) NOT NULL DEFAULT 'local',
        model VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_advisor_admin (admin_id, created_at),
        INDEX idx_ai_advisor_agent (agent_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function aiAdvisorText(array $data, string $key, int $max = 180): string {
    $value = trim((string)($data[$key] ?? ''));
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($max > 0 && $length > $max) $value = function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
    return $value;
}

function aiAdvisorNumber(array $data, string $key): ?float {
    $raw = trim((string)($data[$key] ?? ''));
    if ($raw === '' || !is_numeric($raw)) return null;
    $number = (float)$raw;
    return $number >= 0 ? $number : null;
}

function aiAdvisorLower(?string $value): string {
    $value = trim((string)$value);
    return function_exists('mb_strtolower') ? mb_strtolower($value) : strtolower($value);
}

function aiAdvisorContains(?string $haystack, string $needle): bool {
    if ($needle === '') return true;
    return str_contains(aiAdvisorLower($haystack), aiAdvisorLower($needle));
}

function aiAdvisorMoney($value): float {
    if ($value === null || $value === '') return 0.0;
    if (is_numeric($value)) return max(0.0, (float)$value);
    $raw = preg_replace('/[^0-9.]/', '', (string)$value);
    return is_numeric($raw) ? max(0.0, (float)$raw) : 0.0;
}

function aiAdvisorResolvePlan(PDO $pdo, array $property): ?array {
    if (!empty($property['selected_payment_plan']) && is_array($property['selected_payment_plan'])) {
        return $property['selected_payment_plan'];
    }
    $planId = trim((string)($property['payment_plan_id'] ?? ''));
    if ($planId === '') return null;
    try {
        ensurePaymentPlansTable($pdo);
        $statement = $pdo->prepare('SELECT payment_plan_id AS plan_id,project_id,plan_name,size_label,booking_amount,monthly_installment_count,monthly_installment,half_yearly_count,half_yearly_installment,balloting,on_possession,other_payment,total_price,full_payment_discount_percent,half_payment_discount_percent,preferred_location_charge_percent FROM payment_plans WHERE payment_plan_id=? AND is_active=TRUE LIMIT 1');
        $statement->execute([$planId]);
        $plan = $statement->fetch();
        return $plan ?: null;
    } catch (Throwable $exception) {
        return null;
    }
}

function aiAdvisorCriteria(array $data): array {
    $listingType = aiAdvisorText($data, 'listing_type', 20);
    if (!in_array($listingType, ['', 'sale', 'rent', 'installment'], true)) $listingType = '';
    return [
        'agent_id' => max(0, (int)($data['agent_id'] ?? 0)),
        'client_name' => aiAdvisorText($data, 'client_name', 160),
        'listing_type' => $listingType,
        'budget_min' => aiAdvisorNumber($data, 'budget_min'),
        'budget_max' => aiAdvisorNumber($data, 'budget_max'),
        'monthly_max' => aiAdvisorNumber($data, 'monthly_max'),
        'project_id' => max(0, (int)($data['project_id'] ?? 0)),
        'location' => aiAdvisorText($data, 'location', 160),
        'block' => aiAdvisorText($data, 'block', 120),
        'property_type' => aiAdvisorText($data, 'property_type', 80),
        'size' => aiAdvisorText($data, 'size', 80),
        'facing' => aiAdvisorText($data, 'facing', 80),
        'bedrooms' => aiAdvisorNumber($data, 'bedrooms'),
        'notes' => aiAdvisorText($data, 'notes', 1000),
    ];
}

function aiAdvisorScoreProperty(PDO $pdo, array $property, array $criteria): ?array {
    if (($property['status'] ?? '') !== 'available') return null;

    $score = 12.0; // available inventory baseline
    $maxScore = 12.0;
    $reasons = [];
    $warnings = [];
    $plan = aiAdvisorResolvePlan($pdo, $property);
    $listingType = (string)($property['listing_type'] ?? '');

    if ($criteria['listing_type'] !== '') {
        $maxScore += 18;
        if ($listingType === $criteria['listing_type']) {
            $score += 18;
            $reasons[] = 'Matches the requested listing type';
        } else {
            $warnings[] = 'Different listing type';
        }
    }

    $price = aiAdvisorMoney($property['price_pkr'] ?? null);
    if ($price <= 0 && $plan) $price = aiAdvisorMoney($plan['total_price'] ?? null);
    if ($price <= 0) $price = aiAdvisorMoney($property['price'] ?? null);

    if ($criteria['budget_min'] !== null || $criteria['budget_max'] !== null) {
        $maxScore += 24;
        $min = $criteria['budget_min'] ?? 0;
        $max = $criteria['budget_max'] ?? INF;
        if ($price > 0 && $price >= $min && $price <= $max) {
            $score += 24;
            $reasons[] = 'Inside the client budget';
        } elseif ($price > 0 && is_finite($max) && $price <= $max * 1.12) {
            $score += 10;
            $warnings[] = 'Slightly above the target budget';
        } elseif ($price <= 0) {
            $warnings[] = 'Price needs confirmation';
        } else {
            $warnings[] = 'Outside the target budget';
        }
    }

    $checks = [
        ['key' => 'project_id', 'weight' => 12, 'label' => 'Preferred project', 'match' => fn() => $criteria['project_id'] > 0 && (int)($property['project_id'] ?? 0) === $criteria['project_id']],
        ['key' => 'location', 'weight' => 10, 'label' => 'Preferred location', 'match' => fn() => $criteria['location'] !== '' && (aiAdvisorContains($property['city'] ?? '', $criteria['location']) || aiAdvisorContains($property['address_line1'] ?? '', $criteria['location']) || aiAdvisorContains($property['project_title'] ?? '', $criteria['location']))],
        ['key' => 'block', 'weight' => 8, 'label' => 'Preferred block', 'match' => fn() => $criteria['block'] !== '' && aiAdvisorContains($property['block_name'] ?? '', $criteria['block'])],
        ['key' => 'property_type', 'weight' => 10, 'label' => 'Property type', 'match' => fn() => $criteria['property_type'] !== '' && aiAdvisorLower($property['property_type'] ?? '') === aiAdvisorLower($criteria['property_type'])],
        ['key' => 'size', 'weight' => 8, 'label' => 'Preferred size', 'match' => fn() => $criteria['size'] !== '' && aiAdvisorContains($property['size_label'] ?? '', $criteria['size'])],
        ['key' => 'facing', 'weight' => 5, 'label' => 'Facing / location preference', 'match' => fn() => $criteria['facing'] !== '' && aiAdvisorContains($property['property_facing'] ?? '', $criteria['facing'])],
    ];
    foreach ($checks as $check) {
        $criterionValue = $criteria[$check['key']];
        $active = is_int($criterionValue) ? $criterionValue > 0 : trim((string)$criterionValue) !== '';
        if (!$active) continue;
        $maxScore += $check['weight'];
        if (($check['match'])()) {
            $score += $check['weight'];
            $reasons[] = $check['label'];
        }
    }

    if ($criteria['bedrooms'] !== null) {
        $maxScore += 5;
        $beds = (float)($property['bedrooms'] ?? 0);
        if ($beds >= $criteria['bedrooms']) {
            $score += 5;
            $reasons[] = 'Bedroom requirement met';
        }
    }

    if ($criteria['listing_type'] === 'installment' || $criteria['monthly_max'] !== null) {
        $maxScore += 16;
        if ($plan) {
            $monthly = aiAdvisorMoney($plan['monthly_installment'] ?? null);
            if ($criteria['monthly_max'] === null || ($monthly > 0 && $monthly <= $criteria['monthly_max'])) {
                $score += 16;
                $reasons[] = $criteria['monthly_max'] !== null ? 'Monthly installment fits the target' : 'Connected installment plan available';
            } else {
                $score += 6;
                $warnings[] = 'Monthly installment exceeds target';
            }
        } else {
            $warnings[] = 'No connected payment plan';
        }
    }

    $percent = (int)round(min(100, max(0, ($score / max(1, $maxScore)) * 100)));
    if (!$reasons) $reasons[] = 'Available property in current inventory';

    $media = $property['media'] ?? [];
    $image = $property['image_url'] ?? '';
    if ($image === '' && is_array($media)) {
        foreach ($media as $item) {
            if (($item['media_type'] ?? '') === 'image') { $image = (string)($item['file_path'] ?? ''); break; }
        }
    }

    return [
        'property_id' => (int)($property['property_id'] ?? 0),
        'slug' => (string)($property['slug'] ?? ''),
        'title' => (string)($property['title'] ?? ''),
        'score' => $percent,
        'listing_type' => $listingType,
        'property_type' => (string)($property['property_type'] ?? ''),
        'status' => (string)($property['status'] ?? ''),
        'project_id' => (int)($property['project_id'] ?? 0),
        'project_title' => (string)($property['project_title'] ?? ''),
        'project_plan_name' => (string)($property['project_plan_name'] ?? ''),
        'city' => (string)($property['city'] ?? ''),
        'address' => (string)($property['address_line1'] ?? ''),
        'block' => (string)($property['block_name'] ?? ''),
        'size' => (string)($property['size_label'] ?? ''),
        'facing' => (string)($property['property_facing'] ?? ''),
        'bedrooms' => $property['bedrooms'] ?? null,
        'bathrooms' => $property['bathrooms'] ?? null,
        'area_sqft' => $property['area_sqft'] ?? null,
        'price_pkr' => $price,
        'image_url' => (string)$image,
        'payment_plan' => $plan,
        'reasons' => array_values(array_unique($reasons)),
        'warnings' => array_values(array_unique($warnings)),
    ];
}

function aiAdvisorLocalBrief(array $criteria, array $matches): string {
    if (!$matches) return 'No strong match was found in the current available inventory. Broaden the budget, location, project, size, or listing-type filters and try again.';
    $top = $matches[0];
    $parts = [];
    $parts[] = 'Best match: ' . $top['title'] . ' (' . $top['score'] . '% fit).';
    if ($top['project_title']) $parts[] = 'Project: ' . $top['project_title'] . '.';
    if ($top['price_pkr'] > 0) $parts[] = 'Price: PKR ' . number_format((float)$top['price_pkr']) . '.';
    if (!empty($top['payment_plan']['monthly_installment'])) $parts[] = 'Monthly installment: PKR ' . number_format(aiAdvisorMoney($top['payment_plan']['monthly_installment'])) . '.';
    $parts[] = 'Why it fits: ' . implode(', ', array_slice($top['reasons'], 0, 4)) . '.';
    if (count($matches) > 1) $parts[] = 'Also compare ' . implode(' and ', array_map(static fn($m) => $m['title'] . ' (' . $m['score'] . '%)', array_slice($matches, 1, 2))) . '.';
    $parts[] = 'Agent next step: confirm current availability, final price/charges, and client priorities before making a commitment.';
    return implode(' ', $parts);
}

function aiAdvisorOpenAiBrief(array $criteria, array $matches): ?array {
    $apiKey = trim((string)getenv('OPENAI_API_KEY'));
    $enabled = strtolower(trim((string)(getenv('HEERA_AI_ADVISOR_ENABLED') ?: '1')));
    if ($apiKey === '' || in_array($enabled, ['0','false','off','no'], true) || !$matches || !function_exists('curl_init')) return null;

    $model = trim((string)(getenv('HEERA_AI_ADVISOR_MODEL') ?: 'gpt-5.6-luna'));
    $safeCriteria = $criteria;
    // Do not send client identity to the model; preferences are sufficient.
    unset($safeCriteria['client_name'], $safeCriteria['agent_id']);
    if (!empty($safeCriteria['notes'])) {
        $safeCriteria['notes'] = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email removed]', (string)$safeCriteria['notes']);
        $safeCriteria['notes'] = preg_replace('/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/', '[phone removed]', (string)$safeCriteria['notes']);
    }
    $compactMatches = array_map(static function(array $match): array {
        return [
            'property_id' => $match['property_id'], 'title' => $match['title'], 'score' => $match['score'],
            'listing_type' => $match['listing_type'], 'property_type' => $match['property_type'], 'project' => $match['project_title'],
            'city' => $match['city'], 'block' => $match['block'], 'size' => $match['size'], 'facing' => $match['facing'],
            'bedrooms' => $match['bedrooms'], 'price_pkr' => $match['price_pkr'], 'payment_plan' => $match['payment_plan'],
            'match_reasons' => $match['reasons'], 'warnings' => $match['warnings'],
        ];
    }, array_slice($matches, 0, 5));

    $payload = [
        'model' => $model,
        'store' => false,
        'reasoning' => ['effort' => 'low'],
        'text' => ['verbosity' => 'medium'],
        'max_output_tokens' => 900,
        'instructions' => 'You are an internal property advisor for a real-estate agent. Use ONLY the supplied inventory and facts. Never invent availability, price, payment terms, legal status, returns, or guarantees. Give a concise practical brief with: Best Pick, Why It Fits, 1-2 Alternatives, Agent Talking Points, and 2 Follow-up Questions. Clearly flag items that need confirmation. Do not mention that you are an AI model.',
        'input' => json_encode(['client_preferences' => $safeCriteria, 'ranked_inventory' => $compactMatches], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ];
    if ($payload['input'] === false) return null;

    $curl = curl_init('https://api.openai.com/v1/responses');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);
    $body = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    if ($body === false || $status < 200 || $status >= 300) {
        error_log('[Heera AI Advisor] OpenAI request failed: HTTP ' . $status . ' ' . $curlError);
        return null;
    }
    $decoded = json_decode((string)$body, true);
    if (!is_array($decoded)) return null;

    $text = trim((string)($decoded['output_text'] ?? ''));
    if ($text === '' && !empty($decoded['output']) && is_array($decoded['output'])) {
        foreach ($decoded['output'] as $item) {
            if (($item['type'] ?? '') !== 'message' || empty($item['content']) || !is_array($item['content'])) continue;
            foreach ($item['content'] as $content) {
                if (($content['type'] ?? '') === 'output_text' && isset($content['text'])) $text .= ($text === '' ? '' : "\n") . trim((string)$content['text']);
            }
        }
    }
    if ($text === '') return null;
    return ['text' => $text, 'model' => $model];
}

function aiAdvisorRecommend(array $data): array {
    $admin = requireAdmin();
    $pdo = db();
    ensureAiAdvisorSchema($pdo);
    ensurePropertyPublishingSchema($pdo);
    $criteria = aiAdvisorCriteria($data);

    $properties = listings(false);
    $matches = [];
    foreach ($properties as $property) {
        $scored = aiAdvisorScoreProperty($pdo, $property, $criteria);
        if ($scored !== null) $matches[] = $scored;
    }
    usort($matches, static fn(array $a, array $b): int => ($b['score'] <=> $a['score']) ?: ($b['property_id'] <=> $a['property_id']));
    $matches = array_slice($matches, 0, 8);

    $provider = 'local';
    $model = null;
    $brief = aiAdvisorLocalBrief($criteria, $matches);
    try {
        $ai = aiAdvisorOpenAiBrief($criteria, $matches);
        if ($ai) { $provider = 'openai'; $model = $ai['model']; $brief = $ai['text']; }
    } catch (Throwable $exception) {
        error_log('[Heera AI Advisor] ' . $exception->getMessage());
    }

    try {
        $statement = $pdo->prepare('INSERT INTO ai_advisor_sessions (admin_id,agent_id,client_name,criteria_json,results_json,provider,model) VALUES (?,?,?,?,?,?,?)');
        $statement->execute([
            (int)$admin['admin_id'], $criteria['agent_id'] ?: null, $criteria['client_name'] ?: null,
            json_encode($criteria, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            json_encode(array_map(static fn($m) => ['property_id'=>$m['property_id'],'score'=>$m['score']], $matches), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $provider, $model,
        ]);
        $sessionId = (int)$pdo->lastInsertId();
    } catch (Throwable $exception) {
        error_log('[Heera AI Advisor history] ' . $exception->getMessage());
        $sessionId = 0;
    }

    return [
        'advisor_session_id' => $sessionId,
        'provider' => $provider,
        'model' => $model,
        'criteria' => $criteria,
        'matches' => $matches,
        'brief' => $brief,
        'inventory_count' => count($properties),
        'generated_at' => date(DATE_ATOM),
    ];
}

function aiAdvisorHistory(): array {
    $admin = requireAdmin();
    $pdo = db();
    ensureAiAdvisorSchema($pdo);
    $statement = $pdo->prepare("SELECT s.advisor_session_id,s.agent_id,s.client_name,s.provider,s.model,s.created_at,a.name AS agent_name
        FROM ai_advisor_sessions s LEFT JOIN agents a ON a.agent_id=s.agent_id
        WHERE s.admin_id=? ORDER BY s.advisor_session_id DESC LIMIT 10");
    $statement->execute([(int)$admin['admin_id']]);
    return $statement->fetchAll();
}
