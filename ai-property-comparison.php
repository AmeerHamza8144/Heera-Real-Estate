<?php
declare(strict_types=1);

/**
 * Public AI Property Comparison
 *
 * Supports two sources per side:
 *  - inventory: a currently available Heera Estate property_id
 *  - manual: customer-entered property facts for an off-site listing
 *
 * Comparison is deterministic first. Optional OpenAI output only explains the
 * supplied facts; the local comparison remains available when AI is disabled.
 */

function propertyComparisonText(array $data, string $key, int $max = 220): string {
    $value = trim((string)($data[$key] ?? ''));
    if ($max > 0) {
        $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
        if ($length > $max) $value = function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
    }
    return $value;
}

function propertyComparisonNumber(array $data, string $key): ?float {
    $raw = trim((string)($data[$key] ?? ''));
    if ($raw === '' || !is_numeric($raw)) return null;
    $value = (float)$raw;
    return $value >= 0 ? $value : null;
}

function propertyComparisonMoney($value): float {
    if ($value === null || $value === '') return 0.0;
    if (is_numeric($value)) return max(0.0, (float)$value);
    $clean = preg_replace('/[^0-9.]/', '', (string)$value);
    return is_numeric($clean) ? max(0.0, (float)$clean) : 0.0;
}

function propertyComparisonLower(string $value): string {
    return function_exists('mb_strtolower') ? mb_strtolower(trim($value)) : strtolower(trim($value));
}

function propertyComparisonPlanFromProperty(array $property): ?array {
    $plan = $property['selected_payment_plan'] ?? null;
    if (!is_array($plan) || !$plan) return null;
    return [
        'plan_name' => trim((string)($plan['plan_name'] ?? 'Payment Plan')),
        'size_label' => trim((string)($plan['size_label'] ?? '')),
        'booking_amount' => propertyComparisonMoney($plan['booking_amount'] ?? null),
        'monthly_installment_count' => (int)propertyComparisonMoney($plan['monthly_installment_count'] ?? null),
        'monthly_installment' => propertyComparisonMoney($plan['monthly_installment'] ?? null),
        'half_yearly_count' => (int)propertyComparisonMoney($plan['half_yearly_count'] ?? null),
        'half_yearly_installment' => propertyComparisonMoney($plan['half_yearly_installment'] ?? null),
        'balloting' => propertyComparisonMoney($plan['balloting'] ?? null),
        'on_possession' => propertyComparisonMoney($plan['on_possession'] ?? null),
        'other_payment' => propertyComparisonMoney($plan['other_payment'] ?? null),
        'total_price' => propertyComparisonMoney($plan['total_price'] ?? null),
    ];
}

function propertyComparisonNormalizeInventory(array $property): array {
    $plan = propertyComparisonPlanFromProperty($property);
    $pricePkr = propertyComparisonMoney($property['price_pkr'] ?? null);
    if ($pricePkr <= 0 && $plan) $pricePkr = propertyComparisonMoney($plan['total_price'] ?? null);
    $priceUsd = propertyComparisonMoney($property['price'] ?? null);
    $media = is_array($property['media'] ?? null) ? $property['media'] : [];
    $image = '';
    foreach ($media as $item) {
        if (($item['media_type'] ?? '') === 'image') { $image = trim((string)($item['file_path'] ?? '')); break; }
    }
    return [
        'source' => 'inventory',
        'property_id' => (int)($property['property_id'] ?? 0),
        'slug' => trim((string)($property['slug'] ?? '')),
        'title' => trim((string)($property['title'] ?? 'Property')),
        'listing_type' => trim((string)($property['listing_type'] ?? 'sale')),
        'property_type' => trim((string)($property['property_type'] ?? 'Property')),
        'status' => trim((string)($property['status'] ?? 'available')),
        'project' => trim((string)($property['project_title'] ?? '')),
        'project_plan' => trim((string)($property['project_plan_name'] ?? '')),
        'location' => implode(', ', array_filter([
            trim((string)($property['address_line1'] ?? '')),
            trim((string)($property['city'] ?? '')),
            trim((string)($property['state_region'] ?? '')),
        ])),
        'city' => trim((string)($property['city'] ?? '')),
        'block' => trim((string)($property['block_name'] ?? '')),
        'size_label' => trim((string)($property['size_label'] ?? '')),
        'area_sqft' => (float)($property['area_sqft'] ?? 0),
        'bedrooms' => (float)($property['bedrooms'] ?? 0),
        'bathrooms' => (float)($property['bathrooms'] ?? 0),
        'facing' => trim((string)($property['property_facing'] ?? '')),
        'price_pkr' => $pricePkr,
        'price_usd' => $priceUsd,
        'currency' => $pricePkr > 0 ? 'PKR' : ($priceUsd > 0 ? 'USD' : ''),
        'payment_plan' => $plan,
        'description' => trim((string)($property['description'] ?? '')),
        'image' => $image,
        'external_manual' => false,
    ];
}

function propertyComparisonNormalizeManual(array $data, string $sideLabel): array {
    $title = propertyComparisonText($data, 'title', 180);
    if ($title === '') errorResponse("{$sideLabel}: enter a property name or reference for the manual property.");
    $listingType = propertyComparisonText($data, 'listing_type', 20);
    if (!in_array($listingType, ['sale','rent','installment',''], true)) $listingType = '';
    $propertyType = propertyComparisonText($data, 'property_type', 80);
    $currency = strtoupper(propertyComparisonText($data, 'currency', 3));
    if (!in_array($currency, ['PKR','USD'], true)) $currency = 'PKR';
    $price = propertyComparisonNumber($data, 'price') ?? 0;
    $monthly = propertyComparisonNumber($data, 'monthly_installment') ?? 0;
    $booking = propertyComparisonNumber($data, 'booking_amount') ?? 0;
    $monthlyCount = (int)(propertyComparisonNumber($data, 'monthly_installment_count') ?? 0);
    $halfYearly = propertyComparisonNumber($data, 'half_yearly_installment') ?? 0;
    $halfYearlyCount = (int)(propertyComparisonNumber($data, 'half_yearly_count') ?? 0);
    $possession = propertyComparisonNumber($data, 'on_possession') ?? 0;
    $plan = ($monthly > 0 || $booking > 0 || $halfYearly > 0 || $possession > 0) ? [
        'plan_name' => propertyComparisonText($data, 'plan_name', 120) ?: 'Manual payment plan',
        'size_label' => propertyComparisonText($data, 'size_label', 80),
        'booking_amount' => $booking,
        'monthly_installment_count' => $monthlyCount,
        'monthly_installment' => $monthly,
        'half_yearly_count' => $halfYearlyCount,
        'half_yearly_installment' => $halfYearly,
        'balloting' => propertyComparisonNumber($data, 'balloting') ?? 0,
        'on_possession' => $possession,
        'other_payment' => propertyComparisonNumber($data, 'other_payment') ?? 0,
        'total_price' => $price,
    ] : null;
    return [
        'source' => 'manual',
        'property_id' => 0,
        'slug' => '',
        'title' => $title,
        'listing_type' => $listingType,
        'property_type' => $propertyType,
        'status' => 'customer supplied',
        'project' => propertyComparisonText($data, 'project', 180),
        'project_plan' => '',
        'location' => propertyComparisonText($data, 'location', 255),
        'city' => propertyComparisonText($data, 'city', 100),
        'block' => propertyComparisonText($data, 'block', 120),
        'size_label' => propertyComparisonText($data, 'size_label', 80),
        'area_sqft' => propertyComparisonNumber($data, 'area_sqft') ?? 0,
        'bedrooms' => propertyComparisonNumber($data, 'bedrooms') ?? 0,
        'bathrooms' => propertyComparisonNumber($data, 'bathrooms') ?? 0,
        'facing' => propertyComparisonText($data, 'facing', 80),
        'price_pkr' => $currency === 'PKR' ? $price : 0,
        'price_usd' => $currency === 'USD' ? $price : 0,
        'currency' => $price > 0 ? $currency : '',
        'payment_plan' => $plan,
        'description' => propertyComparisonText($data, 'notes', 1200),
        'image' => '',
        'external_manual' => true,
    ];
}

function propertyComparisonResolveSide(array $side, string $sideLabel): array {
    $source = propertyComparisonLower((string)($side['source'] ?? 'inventory'));
    if ($source === 'manual') return propertyComparisonNormalizeManual($side, $sideLabel);
    $propertyId = max(0, (int)($side['property_id'] ?? 0));
    if ($propertyId < 1) errorResponse("{$sideLabel}: choose a saved property or switch to manual entry.");
    $property = property($propertyId, '');
    return propertyComparisonNormalizeInventory($property);
}

function propertyComparisonDisplayPrice(array $property): string {
    if (($property['price_pkr'] ?? 0) > 0) return 'PKR ' . number_format((float)$property['price_pkr']);
    if (($property['price_usd'] ?? 0) > 0) return '$' . number_format((float)$property['price_usd']);
    return 'Price not provided';
}

function propertyComparisonMetricWinner(float $a, float $b, string $higherIsBetter = 'higher'): string {
    if ($a <= 0 || $b <= 0 || abs($a - $b) < 0.0001) return 'tie';
    if ($higherIsBetter === 'lower') return $a < $b ? 'a' : 'b';
    return $a > $b ? 'a' : 'b';
}

function propertyComparisonPreferences(array $data): array {
    $priority = propertyComparisonText($data, 'priority', 30);
    if (!in_array($priority, ['balanced','price','space','installments','location'], true)) $priority = 'balanced';
    return [
        'budget_max' => propertyComparisonNumber($data, 'budget_max'),
        'monthly_max' => propertyComparisonNumber($data, 'monthly_max'),
        'preferred_location' => propertyComparisonText($data, 'preferred_location', 160),
        'priority' => $priority,
        'notes' => propertyComparisonText($data, 'notes', 1000),
    ];
}

function propertyComparisonScore(array $property, array $other, array $preferences): array {
    $score = 50.0;
    $reasons = [];
    $warnings = [];
    $price = $property['price_pkr'] > 0 ? (float)$property['price_pkr'] : (float)$property['price_usd'];
    $otherPrice = $other['price_pkr'] > 0 ? (float)$other['price_pkr'] : (float)$other['price_usd'];
    $sameCurrency = $property['currency'] !== '' && $property['currency'] === $other['currency'];
    $monthly = propertyComparisonMoney($property['payment_plan']['monthly_installment'] ?? null);
    $otherMonthly = propertyComparisonMoney($other['payment_plan']['monthly_installment'] ?? null);

    if ($preferences['budget_max'] !== null && $property['currency'] === 'PKR') {
        if ($price > 0 && $price <= $preferences['budget_max']) { $score += 16; $reasons[] = 'Fits the stated budget'; }
        elseif ($price > 0) { $score -= 12; $warnings[] = 'Above the stated budget'; }
    }
    if ($preferences['monthly_max'] !== null) {
        if ($monthly > 0 && $monthly <= $preferences['monthly_max']) { $score += 16; $reasons[] = 'Monthly installment fits the target'; }
        elseif ($monthly > 0) { $score -= 10; $warnings[] = 'Monthly installment is above the target'; }
        else $warnings[] = 'No monthly installment supplied';
    }
    if ($preferences['preferred_location'] !== '') {
        $needle = propertyComparisonLower($preferences['preferred_location']);
        $locationText = propertyComparisonLower(implode(' ', [$property['location'],$property['project'],$property['block']]));
        if ($needle !== '' && str_contains($locationText, $needle)) { $score += 12; $reasons[] = 'Matches the preferred location'; }
    }

    if ($sameCurrency && $price > 0 && $otherPrice > 0) {
        if ($price < $otherPrice) { $bonus = $preferences['priority'] === 'price' ? 18 : 9; $score += $bonus; $reasons[] = 'Lower asking price'; }
        elseif ($price > $otherPrice && $preferences['priority'] === 'price') $score -= 6;
    }
    if ($property['area_sqft'] > 0 && $other['area_sqft'] > 0) {
        if ($property['area_sqft'] > $other['area_sqft']) { $bonus = $preferences['priority'] === 'space' ? 18 : 8; $score += $bonus; $reasons[] = 'More floor area'; }
    }
    if ($property['bedrooms'] > 0 && $other['bedrooms'] > 0 && $property['bedrooms'] > $other['bedrooms']) { $score += 4; $reasons[] = 'More bedrooms'; }
    if ($property['bathrooms'] > 0 && $other['bathrooms'] > 0 && $property['bathrooms'] > $other['bathrooms']) { $score += 2; $reasons[] = 'More bathrooms'; }
    if ($property['payment_plan'] && !$other['payment_plan']) { $bonus = $preferences['priority'] === 'installments' ? 18 : 7; $score += $bonus; $reasons[] = 'Payment plan information is available'; }
    if ($monthly > 0 && $otherMonthly > 0 && $monthly < $otherMonthly) { $bonus = $preferences['priority'] === 'installments' ? 15 : 6; $score += $bonus; $reasons[] = 'Lower monthly installment'; }
    if ($property['source'] === 'inventory') $reasons[] = 'Availability is sourced from current Heera Estate inventory';
    else $warnings[] = 'Manual property facts should be independently verified';

    return ['score' => (int)round(max(0, min(100, $score))), 'reasons' => array_values(array_unique($reasons)), 'warnings' => array_values(array_unique($warnings))];
}

function propertyComparisonRows(array $a, array $b): array {
    $monthlyA = propertyComparisonMoney($a['payment_plan']['monthly_installment'] ?? null);
    $monthlyB = propertyComparisonMoney($b['payment_plan']['monthly_installment'] ?? null);
    $bookingA = propertyComparisonMoney($a['payment_plan']['booking_amount'] ?? null);
    $bookingB = propertyComparisonMoney($b['payment_plan']['booking_amount'] ?? null);
    $rows = [
        ['label'=>'Source','a'=>$a['source']==='inventory'?'Heera Estate listing':'Customer-entered property','b'=>$b['source']==='inventory'?'Heera Estate listing':'Customer-entered property','winner'=>'tie'],
        ['label'=>'Listing type','a'=>$a['listing_type'] ?: 'Not provided','b'=>$b['listing_type'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Property type','a'=>$a['property_type'] ?: 'Not provided','b'=>$b['property_type'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Project','a'=>$a['project'] ?: 'Not provided','b'=>$b['project'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Location','a'=>$a['location'] ?: 'Not provided','b'=>$b['location'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Block','a'=>$a['block'] ?: 'Not provided','b'=>$b['block'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Size','a'=>$a['size_label'] ?: ($a['area_sqft']>0?number_format($a['area_sqft']).' sqft':'Not provided'),'b'=>$b['size_label'] ?: ($b['area_sqft']>0?number_format($b['area_sqft']).' sqft':'Not provided'),'winner'=>propertyComparisonMetricWinner((float)$a['area_sqft'],(float)$b['area_sqft'])],
        ['label'=>'Bedrooms','a'=>$a['bedrooms']>0?(string)$a['bedrooms']:'Not provided','b'=>$b['bedrooms']>0?(string)$b['bedrooms']:'Not provided','winner'=>propertyComparisonMetricWinner((float)$a['bedrooms'],(float)$b['bedrooms'])],
        ['label'=>'Bathrooms','a'=>$a['bathrooms']>0?(string)$a['bathrooms']:'Not provided','b'=>$b['bathrooms']>0?(string)$b['bathrooms']:'Not provided','winner'=>propertyComparisonMetricWinner((float)$a['bathrooms'],(float)$b['bathrooms'])],
        ['label'=>'Facing / type','a'=>$a['facing'] ?: 'Not provided','b'=>$b['facing'] ?: 'Not provided','winner'=>'tie'],
        ['label'=>'Price','a'=>propertyComparisonDisplayPrice($a),'b'=>propertyComparisonDisplayPrice($b),'winner'=>($a['currency']!==''&&$a['currency']===$b['currency'])?propertyComparisonMetricWinner((float)($a['price_pkr']?:$a['price_usd']),(float)($b['price_pkr']?:$b['price_usd']),'lower'):'tie'],
        ['label'=>'Booking amount','a'=>$bookingA>0?'PKR '.number_format($bookingA):'Not provided','b'=>$bookingB>0?'PKR '.number_format($bookingB):'Not provided','winner'=>propertyComparisonMetricWinner($bookingA,$bookingB,'lower')],
        ['label'=>'Monthly installment','a'=>$monthlyA>0?'PKR '.number_format($monthlyA):'Not provided','b'=>$monthlyB>0?'PKR '.number_format($monthlyB):'Not provided','winner'=>propertyComparisonMetricWinner($monthlyA,$monthlyB,'lower')],
    ];
    return $rows;
}

function propertyComparisonLocalBrief(array $a, array $b, array $scoreA, array $scoreB, array $preferences): string {
    $difference = abs($scoreA['score'] - $scoreB['score']);
    if ($difference <= 4) {
        $lead = 'The two properties are closely matched based on the information supplied.';
    } else {
        $winner = $scoreA['score'] > $scoreB['score'] ? $a : $b;
        $winnerScore = max($scoreA['score'], $scoreB['score']);
        $lead = $winner['title'] . ' is the stronger fit at ' . $winnerScore . '/100 based on the selected priorities.';
    }
    $aStrength = $scoreA['reasons'][0] ?? 'has useful features to consider';
    $bStrength = $scoreB['reasons'][0] ?? 'has useful features to consider';
    return $lead . ' ' . $a['title'] . ': ' . $aStrength . '. ' . $b['title'] . ': ' . $bStrength . '. Confirm availability, ownership/legal documentation, exact dimensions, charges, and final payment terms before making a purchase decision.';
}

function propertyComparisonRateLimit(): void {
    $now = time();
    $attempts = array_values(array_filter((array)($_SESSION['property_comparison_attempts'] ?? []), static fn($time): bool => is_int($time) && $time > $now - 600));
    if (count($attempts) >= 20) errorResponse('Too many comparison requests. Please wait a few minutes and try again.', 429);
    $attempts[] = $now;
    $_SESSION['property_comparison_attempts'] = $attempts;
}

function propertyComparisonOpenAi(array $a, array $b, array $preferences, array $rows, array $scores): ?array {
    $apiKey = trim((string)getenv('OPENAI_API_KEY'));
    $enabled = strtolower(trim((string)(getenv('HEERA_AI_COMPARISON_ENABLED') ?: getenv('HEERA_AI_ADVISOR_ENABLED') ?: '1')));
    if ($apiKey === '' || in_array($enabled, ['0','false','off','no'], true) || !function_exists('curl_init')) return null;
    $model = trim((string)(getenv('HEERA_AI_COMPARISON_MODEL') ?: getenv('HEERA_AI_ADVISOR_MODEL') ?: 'gpt-5.6-luna'));
    $cleanProperty = static function(array $property): array {
        return [
            'source'=>$property['source'], 'title'=>$property['title'], 'listing_type'=>$property['listing_type'], 'property_type'=>$property['property_type'],
            'project'=>$property['project'], 'location'=>$property['location'], 'block'=>$property['block'], 'size_label'=>$property['size_label'], 'area_sqft'=>$property['area_sqft'],
            'bedrooms'=>$property['bedrooms'], 'bathrooms'=>$property['bathrooms'], 'facing'=>$property['facing'], 'price_pkr'=>$property['price_pkr'], 'price_usd'=>$property['price_usd'],
            'payment_plan'=>$property['payment_plan'], 'notes'=>$property['description'],
        ];
    };
    $safePreferences = $preferences;
    if ($safePreferences['notes'] !== '') {
        $safePreferences['notes'] = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email removed]', (string)$safePreferences['notes']);
        $safePreferences['notes'] = preg_replace('/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/', '[phone removed]', (string)$safePreferences['notes']);
    }
    $payload = [
        'model' => $model,
        'store' => false,
        'reasoning' => ['effort'=>'low'],
        'text' => ['verbosity'=>'medium'],
        'max_output_tokens' => 900,
        'instructions' => 'You are a neutral real-estate comparison assistant. Compare ONLY the supplied property facts. Do not invent prices, legal status, availability, ROI, appreciation, distances, developer reputation, or payment terms. A manually entered property is unverified and must be labelled as such. Provide: Recommendation, Property A strengths, Property B strengths, Key trade-offs, Installment/affordability note if data exists, and What the customer should verify next. If facts are insufficient, say so. Do not present the comparison as legal, financial, or investment advice.',
        'input' => json_encode(['property_a'=>$cleanProperty($a),'property_b'=>$cleanProperty($b),'customer_priorities'=>$safePreferences,'computed_rows'=>$rows,'computed_scores'=>$scores], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
    ];
    if ($payload['input'] === false) return null;
    $curl = curl_init('https://api.openai.com/v1/responses');
    curl_setopt_array($curl, [CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]);
    $body = curl_exec($curl); $status = (int)curl_getinfo($curl,CURLINFO_HTTP_CODE); $error = curl_error($curl); curl_close($curl);
    if ($body === false || $status < 200 || $status >= 300) { error_log('[Heera Property Comparison] AI request failed: HTTP '.$status.' '.$error); return null; }
    $decoded = json_decode((string)$body,true); if(!is_array($decoded)) return null;
    $text = trim((string)($decoded['output_text'] ?? ''));
    if ($text === '' && is_array($decoded['output'] ?? null)) {
        foreach ($decoded['output'] as $item) foreach ((array)($item['content'] ?? []) as $content) if (($content['type'] ?? '') === 'output_text') $text .= ($text===''?'':"\n").trim((string)($content['text'] ?? ''));
    }
    return $text !== '' ? ['text'=>$text,'model'=>$model] : null;
}

function compareProperties(array $data): array {
    propertyComparisonRateLimit();
    $sideA = is_array($data['property_a'] ?? null) ? $data['property_a'] : [];
    $sideB = is_array($data['property_b'] ?? null) ? $data['property_b'] : [];
    $preferences = propertyComparisonPreferences(is_array($data['preferences'] ?? null) ? $data['preferences'] : []);
    $a = propertyComparisonResolveSide($sideA, 'Property A');
    $b = propertyComparisonResolveSide($sideB, 'Property B');
    if ($a['source'] === 'inventory' && $b['source'] === 'inventory' && $a['property_id'] === $b['property_id']) errorResponse('Choose two different properties to compare.');
    $scoreA = propertyComparisonScore($a, $b, $preferences);
    $scoreB = propertyComparisonScore($b, $a, $preferences);
    $rows = propertyComparisonRows($a, $b);
    $provider = 'local'; $model = null;
    $brief = propertyComparisonLocalBrief($a,$b,$scoreA,$scoreB,$preferences);
    try {
        $ai = propertyComparisonOpenAi($a,$b,$preferences,$rows,['a'=>$scoreA,'b'=>$scoreB]);
        if ($ai) { $provider='openai'; $model=$ai['model']; $brief=$ai['text']; }
    } catch (Throwable $exception) { error_log('[Heera Property Comparison] '.$exception->getMessage()); }
    $winner = abs($scoreA['score']-$scoreB['score']) <= 4 ? 'tie' : ($scoreA['score']>$scoreB['score']?'a':'b');
    return [
        'provider'=>$provider,'model'=>$model,'winner'=>$winner,
        'property_a'=>$a,'property_b'=>$b,
        'score_a'=>$scoreA,'score_b'=>$scoreB,
        'rows'=>$rows,'brief'=>$brief,'preferences'=>$preferences,
        'generated_at'=>date(DATE_ATOM),
        'disclaimer'=>'This comparison is informational. Verify availability, title/ownership documents, development approvals, dimensions, taxes/fees, and final payment terms before making a decision.'
    ];
}
