<?php
declare(strict_types=1);

/**
 * Heera Estate Platform v5
 * Non-map production features: client dashboard, saved properties/searches,
 * site visits, CRM activity timeline, audit log, property price history,
 * password recovery, and management reporting.
 */

function platformV5Try(PDO $pdo, string $sql): void {
    try { $pdo->exec($sql); }
    catch (Throwable $exception) { error_log('[Heera platform v5 schema] ' . $exception->getMessage()); }
}

function platformColumnIsNullable(PDO $pdo, string $table, string $column): bool {
    try { $stmt=$pdo->prepare('SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');$stmt->execute([$table,$column]);return strtoupper((string)$stmt->fetchColumn())==='YES'; }
    catch(Throwable $exception){ return false; }
}

function ensurePlatformV5Schema(PDO $pdo): void {
    static $ready = false;
    if ($ready) return;

    // Dependencies are intentionally reused from the existing project schema.
    ensureLoginUsersSchema($pdo);
    ensureAccessControlSchema($pdo);
    ensureEnquiriesTable($pdo);
    ensurePropertySubmissionsTable($pdo);
    ensurePropertyPublishingSchema($pdo);
    ensureAgentsTable($pdo);

    $pdo->exec("CREATE TABLE IF NOT EXISTS saved_properties (
        saved_property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        visitor_token CHAR(36) DEFAULT NULL,
        client_id INT UNSIGNED DEFAULT NULL,
        property_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_saved_property (visitor_token, property_id),
        INDEX idx_saved_client (client_id, created_at),
        INDEX idx_saved_property (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!databaseColumnExists($pdo, 'saved_properties', 'client_id')) {
        platformV5Try($pdo, "ALTER TABLE saved_properties ADD COLUMN client_id INT UNSIGNED NULL AFTER visitor_token");
    }
    // Old builds required visitor_token even though browser favourites were localStorage-only.
    if (!platformColumnIsNullable($pdo,'saved_properties','visitor_token')) platformV5Try($pdo, "ALTER TABLE saved_properties MODIFY visitor_token CHAR(36) NULL");
    if (!structuralIndexExists($pdo, 'saved_properties', 'idx_saved_client')) platformV5Try($pdo, "ALTER TABLE saved_properties ADD INDEX idx_saved_client (client_id, created_at)");
    if (!structuralIndexExists($pdo, 'saved_properties', 'uq_saved_property_client')) platformV5Try($pdo, "ALTER TABLE saved_properties ADD UNIQUE KEY uq_saved_property_client (client_id, property_id)");

    if (!databaseColumnExists($pdo, 'property_submissions', 'client_id')) {
        platformV5Try($pdo, "ALTER TABLE property_submissions ADD COLUMN client_id INT UNSIGNED NULL AFTER submission_id");
        platformV5Try($pdo, "ALTER TABLE property_submissions ADD INDEX idx_submission_client (client_id, created_at)");
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS saved_searches (
        saved_search_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        client_id INT UNSIGNED NOT NULL,
        name VARCHAR(120) NOT NULL,
        criteria_json LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_saved_search_client (client_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS site_visits (
        site_visit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        client_id INT UNSIGNED NOT NULL,
        property_id INT UNSIGNED NOT NULL,
        enquiry_id INT UNSIGNED DEFAULT NULL,
        assigned_agent_id INT UNSIGNED DEFAULT NULL,
        visit_date DATE NOT NULL,
        visit_time TIME NOT NULL,
        status ENUM('requested','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'requested',
        client_notes VARCHAR(1500) DEFAULT NULL,
        admin_notes VARCHAR(2000) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_site_visit_client (client_id, visit_date, status),
        INDEX idx_site_visit_property (property_id, visit_date),
        INDEX idx_site_visit_agent (assigned_agent_id, visit_date),
        INDEX idx_site_visit_status (status, visit_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm_activities (
        activity_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        enquiry_id INT UNSIGNED NOT NULL,
        admin_id INT UNSIGNED DEFAULT NULL,
        activity_type VARCHAR(30) NOT NULL DEFAULT 'note',
        subject VARCHAR(180) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        occurred_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_crm_activity_lead (enquiry_id, occurred_at),
        INDEX idx_crm_activity_admin (admin_id, occurred_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS property_price_history (
        price_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_id INT UNSIGNED NOT NULL,
        old_price_pkr DECIMAL(15,2) DEFAULT NULL,
        new_price_pkr DECIMAL(15,2) DEFAULT NULL,
        old_status VARCHAR(30) DEFAULT NULL,
        new_status VARCHAR(30) DEFAULT NULL,
        changed_by_admin_id INT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_price_history_property (property_id, created_at),
        INDEX idx_price_history_admin (changed_by_admin_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        actor_type ENUM('admin','client','system') NOT NULL DEFAULT 'system',
        actor_id INT UNSIGNED DEFAULT NULL,
        action_key VARCHAR(100) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id VARCHAR(100) DEFAULT NULL,
        summary VARCHAR(500) NOT NULL,
        metadata_json LONGTEXT DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_created (created_at),
        INDEX idx_audit_entity (entity_type, entity_id, created_at),
        INDEX idx_audit_actor (actor_type, actor_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS password_reset_tokens (
        reset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        account_type ENUM('admin','client') NOT NULL,
        account_id INT UNSIGNED NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        requested_ip VARCHAR(45) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_account (account_type, account_id, created_at),
        INDEX idx_password_reset_expiry (expires_at, used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // New permissions are inserted safely for upgraded databases.
    $permissionRows = [
        ['site_visits.view','View site visits','CRM','View customer property viewing requests.'],
        ['site_visits.manage','Manage site visits','CRM','Confirm, assign, complete, or cancel site visits.'],
        ['reports.view','View reports & analytics','Reports','View business pipeline, inventory, and performance summaries.'],
        ['audit.view','View audit log','Security','Review administrative and client data-change activity.'],
    ];
    $permissionInsert = $pdo->prepare('INSERT IGNORE INTO permissions (permission_key,label,module_name,description) VALUES (?,?,?,?)');
    foreach ($permissionRows as $row) $permissionInsert->execute($row);

    // Super Admin gets everything. Manager gets operating tools; audit remains Super Admin-only.
    $pdo->exec("INSERT IGNORE INTO role_permissions (role_id,permission_key)
        SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage','reports.view','audit.view') WHERE r.role_key='super_admin'");
    $pdo->exec("INSERT IGNORE INTO role_permissions (role_id,permission_key)
        SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage','reports.view') WHERE r.role_key='manager'");
    $pdo->exec("INSERT IGNORE INTO role_permissions (role_id,permission_key)
        SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage') WHERE r.role_key='agent'");
    $pdo->exec("INSERT IGNORE INTO role_permissions (role_id,permission_key)
        SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key='reports.view' WHERE r.role_key='accountant'");

    // Foreign keys are additive and optional: shared hosting may block ALTER privileges.
    $foreignKeys = [
        ['saved_properties','fk_saved_client','client_id','client_users','client_id','CASCADE'],
        ['saved_searches','fk_saved_search_client','client_id','client_users','client_id','CASCADE'],
        ['site_visits','fk_site_visit_client','client_id','client_users','client_id','CASCADE'],
        ['site_visits','fk_site_visit_property','property_id','properties','property_id','CASCADE'],
        ['site_visits','fk_site_visit_enquiry','enquiry_id','enquiries','enquiry_id','SET NULL'],
        ['site_visits','fk_site_visit_agent','assigned_agent_id','agents','agent_id','SET NULL'],
        ['crm_activities','fk_crm_activity_enquiry','enquiry_id','enquiries','enquiry_id','CASCADE'],
        ['property_submissions','fk_submission_client','client_id','client_users','client_id','SET NULL'],
        ['property_price_history','fk_price_history_property','property_id','properties','property_id','CASCADE'],
        ['property_price_history','fk_price_history_admin','changed_by_admin_id','admin_users','admin_id','SET NULL'],
    ];
    foreach ($foreignKeys as [$table,$constraint,$column,$refTable,$refColumn,$onDelete]) {
        if (!structuralForeignKeyExists($pdo,$table,$constraint)) platformV5Try($pdo,"ALTER TABLE {$table} ADD CONSTRAINT {$constraint} FOREIGN KEY ({$column}) REFERENCES {$refTable}({$refColumn}) ON DELETE {$onDelete}");
    }

    $ready = true;
}

function platformV5Actor(): array {
    if (!empty($_SESSION['admin_id'])) return ['admin', (int)$_SESSION['admin_id']];
    if (!empty($_SESSION['client_id'])) return ['client', (int)$_SESSION['client_id']];
    return ['system', null];
}

function platformAudit(PDO $pdo, string $action, string $entityType, $entityId, string $summary, array $metadata = []): void {
    try {
        ensurePlatformV5Schema($pdo);
        [$actorType, $actorId] = platformV5Actor();
        $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? '')) ?: null;
        $statement = $pdo->prepare('INSERT INTO audit_logs (actor_type,actor_id,action_key,entity_type,entity_id,summary,metadata_json,ip_address) VALUES (?,?,?,?,?,?,?,?)');
        $statement->execute([$actorType,$actorId,mb_substr($action,0,100),mb_substr($entityType,0,80),$entityId===null?null:mb_substr((string)$entityId,0,100),mb_substr($summary,0,500),$metadata?json_encode($metadata,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE):null,$ip]);
    } catch (Throwable $exception) {
        error_log('[Heera audit] ' . $exception->getMessage());
    }
}

function platformRecordPropertyChange(PDO $pdo, int $propertyId, ?array $before, array $after): void {
    ensurePlatformV5Schema($pdo);
    $oldPrice = $before && $before['price_pkr'] !== null ? (float)$before['price_pkr'] : null;
    $newPrice = array_key_exists('price_pkr',$after) && $after['price_pkr'] !== null ? (float)$after['price_pkr'] : null;
    $oldStatus = $before ? (string)($before['status'] ?? '') : null;
    $newStatus = (string)($after['status'] ?? '');
    if (!$before || $oldPrice !== $newPrice || $oldStatus !== $newStatus) {
        $adminId = !empty($_SESSION['admin_id']) ? (int)$_SESSION['admin_id'] : null;
        $stmt = $pdo->prepare('INSERT INTO property_price_history (property_id,old_price_pkr,new_price_pkr,old_status,new_status,changed_by_admin_id) VALUES (?,?,?,?,?,?)');
        $stmt->execute([$propertyId,$oldPrice,$newPrice,$oldStatus,$newStatus ?: null,$adminId]);
    }
    $title = (string)($after['title'] ?? ($before['title'] ?? 'Property'));
    platformAudit($pdo, $before ? 'property.update' : 'property.create', 'property', $propertyId, ($before ? 'Updated ' : 'Created ') . $title, [
        'old_price_pkr'=>$oldPrice,'new_price_pkr'=>$newPrice,'old_status'=>$oldStatus,'new_status'=>$newStatus
    ]);
}

function platformPropertyPriceHistory(int $propertyId): array {
    $pdo=db(); ensurePlatformV5Schema($pdo); requirePermission('properties.view');
    $stmt=$pdo->prepare("SELECT h.*,CONCAT(COALESCE(a.first_name,''),' ',COALESCE(a.last_name,'')) AS changed_by FROM property_price_history h LEFT JOIN admin_users a ON a.admin_id=h.changed_by_admin_id WHERE h.property_id=? ORDER BY h.created_at DESC,h.price_history_id DESC LIMIT 100");
    $stmt->execute([$propertyId]); return $stmt->fetchAll();
}

function platformRequireClient(): array {
    $client = currentClient();
    if (!$client) errorResponse('Please sign in with a client account to continue.', 401);
    return $client;
}

function platformSavedPropertyRows(PDO $pdo, int $clientId): array {
    $stmt=$pdo->prepare("SELECT p.property_id,p.slug,p.title,p.listing_type,p.property_type,p.status,p.city,p.state_region,p.block_name,p.size_label,p.price_pkr,p.price,
        (SELECT pm.file_path FROM property_media pm WHERE pm.property_id=p.property_id AND pm.media_type='image' ORDER BY pm.is_cover DESC,pm.sort_order,pm.media_id LIMIT 1) AS image_url,
        sp.created_at AS saved_at
        FROM saved_properties sp JOIN properties p ON p.property_id=sp.property_id WHERE sp.client_id=? ORDER BY sp.created_at DESC");
    $stmt->execute([$clientId]); return $stmt->fetchAll();
}

function platformClientSavedProperties(): array {
    $pdo=db(); ensurePlatformV5Schema($pdo); $client=platformRequireClient();
    $rows=platformSavedPropertyRows($pdo,(int)$client['client_id']);
    return ['ids'=>array_map(static fn(array $r):int=>(int)$r['property_id'],$rows),'properties'=>$rows];
}

function platformToggleSavedProperty(array $data): void {
    $pdo=db(); ensurePlatformV5Schema($pdo); $client=platformRequireClient();
    $propertyId=(int)($data['property_id']??0); if($propertyId<1)errorResponse('Choose a valid property.');
    $check=$pdo->prepare('SELECT property_id,title FROM properties WHERE property_id=?');$check->execute([$propertyId]);$property=$check->fetch();if(!$property)errorResponse('This property is no longer available.',404);
    $saved = array_key_exists('saved',$data) ? !empty($data['saved']) : true;
    if($saved){
        $stmt=$pdo->prepare('INSERT IGNORE INTO saved_properties (client_id,property_id) VALUES (?,?)');$stmt->execute([(int)$client['client_id'],$propertyId]);
        platformAudit($pdo,'property.saved','property',$propertyId,'Saved property '.$property['title']);
    } else {
        $stmt=$pdo->prepare('DELETE FROM saved_properties WHERE client_id=? AND property_id=?');$stmt->execute([(int)$client['client_id'],$propertyId]);
        platformAudit($pdo,'property.unsaved','property',$propertyId,'Removed saved property '.$property['title']);
    }
    respond(['saved'=>$saved,'property_id'=>$propertyId]);
}

function platformSyncSavedProperties(array $data): void {
    $pdo=db(); ensurePlatformV5Schema($pdo); $client=platformRequireClient();
    $ids=array_values(array_unique(array_filter(array_map('intval',(array)($data['property_ids']??[])),static fn(int $id):bool=>$id>0)));
    $ids=array_slice($ids,0,100);
    if($ids){$check=$pdo->prepare('SELECT property_id FROM properties WHERE property_id=?');$insert=$pdo->prepare('INSERT IGNORE INTO saved_properties (client_id,property_id) VALUES (?,?)');foreach($ids as $id){$check->execute([$id]);if($check->fetchColumn())$insert->execute([(int)$client['client_id'],$id]);}}
    $rows=platformSavedPropertyRows($pdo,(int)$client['client_id']);
    respond(['ids'=>array_map(static fn(array $r):int=>(int)$r['property_id'],$rows)]);
}

function platformSavedSearchCriteria(array $data): array {
    $allowed=['listing_type','project_id','block','size','min_price','max_price','property_type','facing','availability','payment_plan'];
    $out=[];foreach($allowed as $key){if(!array_key_exists($key,$data))continue;$value=is_scalar($data[$key])?trim((string)$data[$key]):'';if($value!=='')$out[$key]=mb_substr($value,0,180);}return $out;
}

function platformSaveSavedSearch(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);$client=platformRequireClient();
    $id=(int)($data['saved_search_id']??0);$name=trim((string)($data['name']??''));$criteria=platformSavedSearchCriteria((array)($data['criteria']??$data));
    if(!$criteria)errorResponse('Choose at least one search filter before saving.');if($id<1){$count=$pdo->prepare('SELECT COUNT(*) FROM saved_searches WHERE client_id=?');$count->execute([(int)$client['client_id']]);if((int)$count->fetchColumn()>=25)errorResponse('You can keep up to 25 saved searches. Delete an older search first.',409);}
    if($name==='')$name='Property search '.date('d M');$name=mb_substr($name,0,120);
    if($id>0){$stmt=$pdo->prepare('UPDATE saved_searches SET name=?,criteria_json=? WHERE saved_search_id=? AND client_id=?');$stmt->execute([$name,json_encode($criteria,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$id,(int)$client['client_id']]);if(!$stmt->rowCount())errorResponse('Saved search not found.',404);}else{$stmt=$pdo->prepare('INSERT INTO saved_searches (client_id,name,criteria_json) VALUES (?,?,?)');$stmt->execute([(int)$client['client_id'],$name,json_encode($criteria,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);$id=(int)$pdo->lastInsertId();}
    platformAudit($pdo,'saved_search.save','saved_search',$id,'Saved property search '.$name,['criteria'=>$criteria]);respond(['saved'=>true,'saved_search_id'=>$id]);
}

function platformDeleteSavedSearch(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);$client=platformRequireClient();$id=(int)($data['saved_search_id']??0);$stmt=$pdo->prepare('DELETE FROM saved_searches WHERE saved_search_id=? AND client_id=?');$stmt->execute([$id,(int)$client['client_id']]);if(!$stmt->rowCount())errorResponse('Saved search not found.',404);platformAudit($pdo,'saved_search.delete','saved_search',$id,'Deleted a saved property search');respond(['deleted'=>true]);
}

function platformCreateLeadForSiteVisit(PDO $pdo, array $client, array $property, string $dateTime, string $notes): int {
    ensureEnquiriesTable($pdo);
    $email=trim((string)($client['email']??'')); if($email==='')$email='sitevisit+'.(int)$client['client_id'].'@heera-estate.local';
    $stmt=$pdo->prepare("INSERT INTO enquiries (property_id,name,email,phone,interest,message,status,source,lead_stage,priority,lead_score,preferred_project,preferred_location,preferred_property_type,preferred_size,preferred_listing_type,next_follow_up) VALUES (?,?,?,?,? ,?,'contacted','site_visit','viewing','high',80,?,?,?,?,?,?)");
    $stmt->execute([(int)$property['property_id'],$client['full_name'],$email,$client['phone']?:null,'buying',$notes?:'Site visit requested', $property['project_title']??null,$property['city']??null,$property['property_type']??null,$property['size_label']??null,$property['listing_type']??null,$dateTime]);
    return (int)$pdo->lastInsertId();
}

function platformBookSiteVisit(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);$client=platformRequireClient();$propertyId=(int)($data['property_id']??0);$date=trim((string)($data['visit_date']??''));$time=trim((string)($data['visit_time']??''));$notes=mb_substr(trim((string)($data['notes']??'')),0,1500);
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)||$date<date('Y-m-d'))errorResponse('Choose today or a future visit date.');
    if(!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$time))errorResponse('Choose a valid visit time.');if($time<'09:00'||$time>'19:00')errorResponse('Site visits can be requested between 09:00 and 19:00.');
    $dateTime=$date.' '.$time.':00';if(strtotime($dateTime)<time()+1800)errorResponse('Choose a visit time at least 30 minutes from now.');$stmt=$pdo->prepare("SELECT p.property_id,p.title,p.city,p.property_type,p.size_label,p.listing_type,p.project_id,pr.title AS project_title FROM properties p LEFT JOIN projects pr ON pr.project_id=p.project_id WHERE p.property_id=? AND p.status='available' AND (p.publish_start_date IS NULL OR p.publish_start_date<=CURRENT_DATE) AND (p.publish_end_date IS NULL OR p.publish_end_date>=CURRENT_DATE) LIMIT 1");$stmt->execute([$propertyId]);$property=$stmt->fetch();if(!$property)errorResponse('This property is not currently available for a site visit.',404);
    $duplicate=$pdo->prepare("SELECT site_visit_id FROM site_visits WHERE client_id=? AND property_id=? AND visit_date=? AND status IN ('requested','confirmed') LIMIT 1");$duplicate->execute([(int)$client['client_id'],$propertyId,$date]);if($duplicate->fetchColumn())errorResponse('You already have an active visit request for this property on that date.',409);$active=$pdo->prepare("SELECT COUNT(*) FROM site_visits WHERE client_id=? AND visit_date>=CURDATE() AND status IN ('requested','confirmed')");$active->execute([(int)$client['client_id']]);if((int)$active->fetchColumn()>=5)errorResponse('You already have five active upcoming site visits. Complete or cancel one before booking another.',409);
    $pdo->beginTransaction();try{$leadId=platformCreateLeadForSiteVisit($pdo,$client,$property,$dateTime,$notes);$insert=$pdo->prepare('INSERT INTO site_visits (client_id,property_id,enquiry_id,visit_date,visit_time,client_notes) VALUES (?,?,?,?,?,?)');$insert->execute([(int)$client['client_id'],$propertyId,$leadId,$date,$time.':00',$notes?:null]);$visitId=(int)$pdo->lastInsertId();$pdo->commit();platformAudit($pdo,'site_visit.request','site_visit',$visitId,'Requested site visit for '.$property['title'],['property_id'=>$propertyId,'visit_date'=>$date,'visit_time'=>$time]);respond(['booked'=>true,'site_visit_id'=>$visitId]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function platformCancelSiteVisit(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);$client=platformRequireClient();$id=(int)($data['site_visit_id']??0);$find=$pdo->prepare("SELECT enquiry_id FROM site_visits WHERE site_visit_id=? AND client_id=? AND status IN ('requested','confirmed')");$find->execute([$id,(int)$client['client_id']]);$visit=$find->fetch();if(!$visit)errorResponse('This visit cannot be cancelled.',409);$stmt=$pdo->prepare("UPDATE site_visits SET status='cancelled' WHERE site_visit_id=? AND client_id=?");$stmt->execute([$id,(int)$client['client_id']]);if(!empty($visit['enquiry_id'])){$pdo->prepare("UPDATE enquiries SET lead_stage='nurturing',status='contacted',next_follow_up=NULL WHERE enquiry_id=?")->execute([(int)$visit['enquiry_id']]);platformInsertCrmActivity($pdo,(int)$visit['enquiry_id'],'site_visit','Site visit cancelled','Client cancelled the scheduled property viewing.',date('Y-m-d H:i:s'));}platformAudit($pdo,'site_visit.cancel','site_visit',$id,'Client cancelled a site visit');respond(['cancelled'=>true]);
}

function platformAdminSiteVisits(): array {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('site_visits.view');
    return $pdo->query("SELECT sv.*,p.title AS property_title,p.slug AS property_slug,c.full_name AS client_name,c.email AS client_email,c.phone AS client_phone,a.name AS agent_name,e.lead_stage,e.priority FROM site_visits sv JOIN properties p ON p.property_id=sv.property_id JOIN client_users c ON c.client_id=sv.client_id LEFT JOIN agents a ON a.agent_id=sv.assigned_agent_id LEFT JOIN enquiries e ON e.enquiry_id=sv.enquiry_id ORDER BY sv.visit_date DESC,sv.visit_time DESC,sv.site_visit_id DESC LIMIT 500")->fetchAll();
}

function platformSaveSiteVisit(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('site_visits.manage');$id=(int)($data['site_visit_id']??0);if($id<1)errorResponse('Choose a valid site visit.');
    $select=$pdo->prepare('SELECT * FROM site_visits WHERE site_visit_id=?');$select->execute([$id]);$before=$select->fetch();if(!$before)errorResponse('Site visit not found.',404);
    $status=array_key_exists('status',$data)?allowedValue(strtolower((string)$data['status']),['requested','confirmed','completed','cancelled','no_show'],'site visit status'):(string)$before['status'];
    $agent=array_key_exists('assigned_agent_id',$data)?(int)$data['assigned_agent_id']:(int)($before['assigned_agent_id']??0);$agent=$agent>0?$agent:null;if($agent!==null){$agentCheck=$pdo->prepare('SELECT agent_id FROM agents WHERE agent_id=?');$agentCheck->execute([$agent]);if(!$agentCheck->fetchColumn())errorResponse('Choose a valid agent.');}
    $date=trim((string)($data['visit_date']??$before['visit_date']));$time=substr(trim((string)($data['visit_time']??$before['visit_time'])),0,5);if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)||!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$time))errorResponse('Choose a valid visit date and time.');
    $adminNotes=array_key_exists('admin_notes',$data)?mb_substr(trim((string)$data['admin_notes']),0,2000):(string)($before['admin_notes']??'');
    $stmt=$pdo->prepare('UPDATE site_visits SET assigned_agent_id=?,visit_date=?,visit_time=?,status=?,admin_notes=? WHERE site_visit_id=?');$stmt->execute([$agent,$date,$time.':00',$status,$adminNotes?:null,$id]);
    if(!empty($before['enquiry_id'])){$stage=$status==='completed'?'negotiation':($status==='confirmed'?'viewing':($status==='cancelled'||$status==='no_show'?'nurturing':'viewing'));$next=($status==='requested'||$status==='confirmed')?$date.' '.$time.':00':null;$lead=$pdo->prepare('UPDATE enquiries SET assigned_agent_id=?,lead_stage=?,status=?,next_follow_up=? WHERE enquiry_id=?');$lead->execute([$agent,$stage,crmStatusForStage($stage),$next,(int)$before['enquiry_id']]);platformInsertCrmActivity($pdo,(int)$before['enquiry_id'],'site_visit','Site visit '.str_replace('_',' ',$status),'Visit scheduled for '.$date.' '.$time,date('Y-m-d H:i:s'));}
    platformAudit($pdo,'site_visit.update','site_visit',$id,'Updated site visit status to '.$status,['old_status'=>$before['status'],'new_status'=>$status,'assigned_agent_id'=>$agent]);respond(['saved'=>true]);
}

function platformInsertCrmActivity(PDO $pdo,int $enquiryId,string $type,string $subject,string $notes,string $occurredAt): int {
    $adminId=!empty($_SESSION['admin_id'])?(int)$_SESSION['admin_id']:null;$stmt=$pdo->prepare('INSERT INTO crm_activities (enquiry_id,admin_id,activity_type,subject,notes,occurred_at) VALUES (?,?,?,?,?,?)');$stmt->execute([$enquiryId,$adminId,$type,mb_substr($subject,0,180),$notes?:null,$occurredAt]);return (int)$pdo->lastInsertId();
}

function platformCrmActivities(int $enquiryId): array {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('crm.view');$stmt=$pdo->prepare("SELECT ca.*,CONCAT(COALESCE(a.first_name,''),' ',COALESCE(a.last_name,'')) AS admin_name FROM crm_activities ca LEFT JOIN admin_users a ON a.admin_id=ca.admin_id WHERE ca.enquiry_id=? ORDER BY ca.occurred_at DESC,ca.activity_id DESC LIMIT 200");$stmt->execute([$enquiryId]);return $stmt->fetchAll();
}

function platformSaveCrmActivity(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('crm.manage');$leadId=(int)($data['enquiry_id']??0);if($leadId<1)errorResponse('Choose a CRM lead.');$check=$pdo->prepare('SELECT enquiry_id,name FROM enquiries WHERE enquiry_id=?');$check->execute([$leadId]);$lead=$check->fetch();if(!$lead)errorResponse('CRM lead not found.',404);
    $type=allowedValue(strtolower(trim((string)($data['activity_type']??'note'))),['call','whatsapp','email','meeting','site_visit','note','status_change'],'activity type');$subject=mb_substr(trim((string)($data['subject']??ucfirst(str_replace('_',' ',$type)))),0,180);$notes=mb_substr(trim((string)($data['notes']??'')),0,5000);$occurred=trim((string)($data['occurred_at']??''));$time=$occurred!==''?strtotime($occurred):time();if($time===false)errorResponse('Choose a valid activity date/time.');$id=platformInsertCrmActivity($pdo,$leadId,$type,$subject,$notes,date('Y-m-d H:i:s',$time));
    if(array_key_exists('next_follow_up',$data)){$raw=trim((string)$data['next_follow_up']);$next=null;if($raw!==''){$nextTime=strtotime($raw);if($nextTime===false)errorResponse('Choose a valid next follow-up date/time.');$next=date('Y-m-d H:i:s',$nextTime);}$pdo->prepare('UPDATE enquiries SET next_follow_up=? WHERE enquiry_id=?')->execute([$next,$leadId]);}
    platformAudit($pdo,'crm.activity','enquiry',$leadId,'Added '.$type.' activity for '.$lead['name'],['activity_id'=>$id]);respond(['saved'=>true,'activity_id'=>$id]);
}

function platformClientDashboard(): array {
    $pdo=db();ensurePlatformV5Schema($pdo);$client=platformRequireClient();$clientId=(int)$client['client_id'];
    $saved=platformSavedPropertyRows($pdo,$clientId);
    $searchStmt=$pdo->prepare('SELECT * FROM saved_searches WHERE client_id=? ORDER BY updated_at DESC');$searchStmt->execute([$clientId]);$searches=$searchStmt->fetchAll();foreach($searches as &$search){$search['criteria']=json_decode((string)$search['criteria_json'],true)?:[];unset($search['criteria_json']);}unset($search);
    $visitStmt=$pdo->prepare("SELECT sv.*,p.title AS property_title,p.slug AS property_slug,a.name AS agent_name FROM site_visits sv JOIN properties p ON p.property_id=sv.property_id LEFT JOIN agents a ON a.agent_id=sv.assigned_agent_id WHERE sv.client_id=? ORDER BY sv.visit_date DESC,sv.visit_time DESC");$visitStmt->execute([$clientId]);
    $submissionStmt=$pdo->prepare("SELECT submission_id,title,status,price_pkr,publish_start_date,publish_end_date,approved_property_id,created_at,updated_at FROM property_submissions WHERE client_id=? OR (client_id IS NULL AND ((seller_email IS NOT NULL AND seller_email=?) OR (seller_phone IS NOT NULL AND seller_phone=?))) ORDER BY created_at DESC LIMIT 100");$submissionStmt->execute([$clientId,$client['email']??'', $client['phone']??'']);
    return ['client'=>['id'=>$clientId,'name'=>$client['full_name'],'email'=>$client['email'],'phone'=>$client['phone']],'saved_properties'=>$saved,'saved_searches'=>$searches,'site_visits'=>$visitStmt->fetchAll(),'submissions'=>$submissionStmt->fetchAll()];
}

function platformReports(): array {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('reports.view');
    $scalar=static function(PDO $pdo,string $sql):float{try{return (float)$pdo->query($sql)->fetchColumn();}catch(Throwable $e){return 0;}};
    $rows=static function(PDO $pdo,string $sql):array{try{return $pdo->query($sql)->fetchAll();}catch(Throwable $e){return [];}};
    return [
        'summary'=>[
            'properties_total'=>(int)$scalar($pdo,'SELECT COUNT(*) FROM properties'),
            'properties_available'=>(int)$scalar($pdo,"SELECT COUNT(*) FROM properties WHERE status='available'"),
            'inventory_value_pkr'=>$scalar($pdo,"SELECT COALESCE(SUM(price_pkr),0) FROM properties WHERE status='available'"),
            'leads_30d'=>(int)$scalar($pdo,"SELECT COUNT(*) FROM enquiries WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)"),
            'won_30d'=>(int)$scalar($pdo,"SELECT COUNT(*) FROM enquiries WHERE lead_stage='won' AND updated_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)"),
            'visits_upcoming'=>(int)$scalar($pdo,"SELECT COUNT(*) FROM site_visits WHERE visit_date>=CURDATE() AND status IN ('requested','confirmed')"),
            'pending_submissions'=>(int)$scalar($pdo,"SELECT COUNT(*) FROM property_submissions WHERE status='pending'")
        ],
        'inventory_status'=>$rows($pdo,'SELECT status,COUNT(*) AS total,COALESCE(SUM(price_pkr),0) AS value_pkr FROM properties GROUP BY status ORDER BY total DESC'),
        'property_types'=>$rows($pdo,'SELECT property_type,COUNT(*) AS total FROM properties GROUP BY property_type ORDER BY total DESC'),
        'crm_stages'=>$rows($pdo,'SELECT lead_stage,COUNT(*) AS total FROM enquiries GROUP BY lead_stage ORDER BY total DESC'),
        'lead_sources'=>$rows($pdo,'SELECT source,COUNT(*) AS total FROM enquiries GROUP BY source ORDER BY total DESC LIMIT 12'),
        'monthly_leads'=>$rows($pdo,"SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,COUNT(*) AS total FROM enquiries WHERE created_at>=DATE_SUB(CURDATE(),INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month"),
        'site_visit_status'=>$rows($pdo,'SELECT status,COUNT(*) AS total FROM site_visits GROUP BY status ORDER BY total DESC'),
        'projects'=>$rows($pdo,"SELECT COALESCE(pr.title,'Unlinked') AS project,COUNT(p.property_id) AS properties,COALESCE(SUM(CASE WHEN p.status='available' THEN p.price_pkr ELSE 0 END),0) AS available_value_pkr FROM properties p LEFT JOIN projects pr ON pr.project_id=p.project_id GROUP BY pr.project_id,pr.title ORDER BY properties DESC LIMIT 20")
    ];
}

function platformAuditLogs(): array {
    $pdo=db();ensurePlatformV5Schema($pdo);requirePermission('audit.view');
    return $pdo->query("SELECT al.*,CASE WHEN al.actor_type='admin' THEN (SELECT CONCAT(first_name,' ',last_name) FROM admin_users a WHERE a.admin_id=al.actor_id) WHEN al.actor_type='client' THEN (SELECT full_name FROM client_users c WHERE c.client_id=al.actor_id) ELSE 'System' END AS actor_name FROM audit_logs al ORDER BY al.created_at DESC,al.audit_id DESC LIMIT 500")->fetchAll();
}

function platformResetBaseUrl(): string {
    $configured=rtrim(trim((string)getenv('HEERA_SITE_URL')),'/');if($configured!=='')return $configured;
    $https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';$host=preg_replace('/[^A-Za-z0-9.\-:\[\]]/','',(string)($_SERVER['HTTP_HOST']??'localhost'))?:'localhost';$dir=rtrim(str_replace('\\','/',dirname((string)($_SERVER['SCRIPT_NAME']??'/api.php'))),'/');return ($https?'https':'http').'://'.$host.($dir===''?'':$dir);
}

function platformRequestPasswordReset(array $data): void {
    loginRateLimit('password_reset');$_SESSION['login_attempts']['password_reset'][]=time();$pdo=db();ensurePlatformV5Schema($pdo);$identity=trim((string)($data['identity']??''));if($identity==='')errorResponse('Enter your email address or phone number.');
    $accountType=null;$accountId=0;$email='';$name='';
    $stmt=$pdo->prepare("SELECT client_id,full_name,email,phone FROM client_users WHERE (LOWER(email)=LOWER(?) OR REPLACE(REPLACE(phone,' ',''),'-','')=?) AND is_active=TRUE LIMIT 1");$stmt->execute([$identity,preg_replace('/\s+/','',$identity)]);$row=$stmt->fetch();
    if($row){$accountType='client';$accountId=(int)$row['client_id'];$email=(string)($row['email']??'');$name=(string)$row['full_name'];}
    if(!$row && filter_var($identity,FILTER_VALIDATE_EMAIL)){$stmt=$pdo->prepare('SELECT admin_id,CONCAT(first_name," ",last_name) AS full_name,email FROM admin_users WHERE LOWER(email)=LOWER(?) AND is_active=TRUE LIMIT 1');$stmt->execute([$identity]);$row=$stmt->fetch();if($row){$accountType='admin';$accountId=(int)$row['admin_id'];$email=(string)$row['email'];$name=(string)$row['full_name'];}}
    $response=['message'=>'If an account with a usable email exists, a password-reset link has been prepared. Check your inbox or contact Heera Estate administration.'];
    if($accountType && $accountId>0 && filter_var($email,FILTER_VALIDATE_EMAIL)){
        $pdo->prepare('UPDATE password_reset_tokens SET used_at=NOW() WHERE account_type=? AND account_id=? AND used_at IS NULL')->execute([$accountType,$accountId]);$token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);$expires=date('Y-m-d H:i:s',time()+1800);$pdo->prepare('INSERT INTO password_reset_tokens (account_type,account_id,token_hash,expires_at,requested_ip) VALUES (?,?,?,?,?)')->execute([$accountType,$accountId,$hash,$expires,($_SERVER['REMOTE_ADDR']??null)]);$url=platformResetBaseUrl().'/reset-password.html?token='.rawurlencode($token);
        $subject='Reset your Heera Estate password';$body="Hello ".($name?:'there').",\n\nUse this secure link to reset your Heera Estate password. It expires in 30 minutes:\n\n{$url}\n\nIf you did not request this, you can ignore this message.\n";$from=trim((string)getenv('HEERA_PASSWORD_RESET_FROM'));$headers=$from!==''?'From: '.$from."\r\n":'';@mail($email,$subject,$body,$headers);
        if((string)getenv('HEERA_PASSWORD_RESET_DEBUG')==='1')$response['reset_url']=$url;
        platformAudit($pdo,'password_reset.request',$accountType,$accountId,'Password reset requested');
    }
    respond($response);
}

function platformResetPassword(array $data): void {
    $pdo=db();ensurePlatformV5Schema($pdo);$token=trim((string)($data['token']??''));$password=(string)($data['password']??'');if(!preg_match('/^[a-f0-9]{64}$/i',$token))errorResponse('This password-reset link is invalid or expired.',400);if(strlen($password)<8)errorResponse('Password must contain at least 8 characters.');
    $hash=hash('sha256',$token);$stmt=$pdo->prepare('SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() LIMIT 1');$stmt->execute([$hash]);$reset=$stmt->fetch();if(!$reset)errorResponse('This password-reset link is invalid or expired.',410);$newHash=password_hash($password,PASSWORD_DEFAULT);$pdo->beginTransaction();try{if($reset['account_type']==='client')$pdo->prepare('UPDATE client_users SET password_hash=? WHERE client_id=?')->execute([$newHash,(int)$reset['account_id']]);else$pdo->prepare('UPDATE admin_users SET password_hash=? WHERE admin_id=?')->execute([$newHash,(int)$reset['account_id']]);$pdo->prepare('UPDATE password_reset_tokens SET used_at=NOW() WHERE reset_id=?')->execute([(int)$reset['reset_id']]);$pdo->prepare('UPDATE password_reset_tokens SET used_at=NOW() WHERE account_type=? AND account_id=? AND used_at IS NULL')->execute([$reset['account_type'],(int)$reset['account_id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    try{$stmt=$pdo->prepare('INSERT INTO audit_logs (actor_type,actor_id,action_key,entity_type,entity_id,summary,ip_address) VALUES (?,?,?,?,?,?,?)');$stmt->execute([$reset['account_type'],(int)$reset['account_id'],'password_reset.complete',$reset['account_type'],(string)$reset['account_id'],'Password reset completed',($_SERVER['REMOTE_ADDR']??null)]);}catch(Throwable $e){}
    respond(['reset'=>true,'message'=>'Your password has been reset. You can now sign in.']);
}
