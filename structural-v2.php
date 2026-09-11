<?php
declare(strict_types=1);

/**
 * Structural upgrade v2
 * - normalized sub-projects
 * - role based access control
 * - relational integrity / foreign keys
 *
 * api-core.php loads this file after declaring the shared helpers.
 */

function structuralTableExists(PDO $pdo, string $table): bool {
    try {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
        $stmt->execute([$table]);
        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $e) { return false; }
}

function structuralColumnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
        $stmt->execute([$table, $column]);
        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $e) { return false; }
}

function structuralIndexExists(PDO $pdo, string $table, string $index): bool {
    try {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?');
        $stmt->execute([$table, $index]);
        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $e) { return false; }
}

function structuralForeignKeyExists(PDO $pdo, string $table, string $constraint): bool {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=? AND CONSTRAINT_TYPE='FOREIGN KEY'");
        $stmt->execute([$table, $constraint]);
        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $e) { return false; }
}

function structuralAddForeignKey(PDO $pdo, string $table, string $constraint, string $column, string $refTable, string $refColumn, string $onDelete = 'RESTRICT'): void {
    if (structuralForeignKeyExists($pdo, $table, $constraint)) return;
    $allowedDelete = ['RESTRICT','CASCADE','SET NULL','NO ACTION'];
    if (!in_array($onDelete, $allowedDelete, true)) $onDelete = 'RESTRICT';
    try {
        $pdo->exec("ALTER TABLE `{$table}` ADD CONSTRAINT `{$constraint}` FOREIGN KEY (`{$column}`) REFERENCES `{$refTable}` (`{$refColumn}`) ON DELETE {$onDelete} ON UPDATE CASCADE");
    } catch (Throwable $e) {
        error_log('[Heera structural FK]['.$constraint.'] '.$e->getMessage());
    }
}

function ensureSubProjectsSchema(PDO $pdo): void {
    static $ready = [];
    $key = spl_object_id($pdo);
    if (!empty($ready[$key])) return;

    $pdo->exec("CREATE TABLE IF NOT EXISTS sub_projects (
        sub_project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED NOT NULL,
        name VARCHAR(180) NOT NULL,
        slug VARCHAR(190) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
        sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sub_project_name (project_id,name),
        UNIQUE KEY uq_sub_project_slug (slug),
        INDEX idx_sub_project_project (project_id,status,sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (structuralTableExists($pdo, 'properties') && !structuralColumnExists($pdo, 'properties', 'sub_project_id')) {
        $pdo->exec('ALTER TABLE properties ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id');
    }
    if (structuralTableExists($pdo, 'properties') && !structuralIndexExists($pdo, 'properties', 'idx_property_sub_project')) {
        $pdo->exec('ALTER TABLE properties ADD INDEX idx_property_sub_project (sub_project_id)');
    }

    if (function_exists('ensurePaymentPlansTable')) ensurePaymentPlansTable($pdo);
    if (structuralTableExists($pdo, 'payment_plans') && !structuralColumnExists($pdo, 'payment_plans', 'sub_project_id')) {
        $pdo->exec('ALTER TABLE payment_plans ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id');
    }
    if (structuralTableExists($pdo, 'payment_plans') && !structuralIndexExists($pdo, 'payment_plans', 'idx_payment_plans_sub_project')) {
        $pdo->exec('ALTER TABLE payment_plans ADD INDEX idx_payment_plans_sub_project (sub_project_id,is_active,sort_order)');
    }

    // One-time compatibility migration: turn the old projects.plan_name label into
    // a real sub-project record. The legacy column is kept read-only for old URLs.
    if (structuralColumnExists($pdo, 'projects', 'plan_name')) {
        $rows = $pdo->query("SELECT project_id,plan_name FROM projects WHERE plan_name IS NOT NULL AND TRIM(plan_name)<>''")->fetchAll();
        $insert = $pdo->prepare("INSERT IGNORE INTO sub_projects (project_id,name,slug,status) VALUES (?,?,?, 'published')");
        foreach ($rows as $row) {
            $name = trim((string)$row['plan_name']);
            $slug = function_exists('seo_slugify') ? seo_slugify($name . '-' . $row['project_id']) : null;
            $insert->execute([(int)$row['project_id'], $name, $slug ?: null]);
        }
    }

    $ready[$key] = true;
}

function subProjects(int $projectId = 0, bool $admin = false, bool $enforcePermission = true): array {
    $pdo = db();
    ensureSubProjectsSchema($pdo);
    if ($admin && $enforcePermission) requirePermission('subprojects.view');
    $where = [];
    $params = [];
    if ($projectId > 0) { $where[] = 'sp.project_id=?'; $params[] = $projectId; }
    if (!$admin) $where[] = "sp.status='published' AND p.status='published'";
    $sql = "SELECT sp.sub_project_id,sp.project_id,sp.name,sp.slug,sp.description,sp.status,sp.sort_order,sp.created_at,sp.updated_at,p.title AS project_title,p.location AS project_location,
            (SELECT COUNT(*) FROM payment_plans pp WHERE pp.sub_project_id=sp.sub_project_id AND pp.is_active=TRUE) AS payment_plan_count,
            (SELECT COUNT(*) FROM properties pr WHERE pr.sub_project_id=sp.sub_project_id) AS property_count
            FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id";
    if ($where) $sql .= ' WHERE '.implode(' AND ', $where);
    $sql .= ' ORDER BY p.title,sp.sort_order,sp.name,sp.sub_project_id';
    $stored = heeraStoredRows($pdo,'heera_v4_subprojects',[$projectId,$admin ? 1 : 0]);
    if ($stored !== null) return $stored;
    $stmt = $pdo->prepare($sql); $stmt->execute($params);
    return $stmt->fetchAll();
}

function saveSubProject(array $data): void {
    requirePermission('subprojects.manage');
    $pdo = db(); ensureSubProjectsSchema($pdo);
    $id = (int)($data['sub_project_id'] ?? 0);
    $projectId = (int)($data['project_id'] ?? 0);
    $name = stringValue($data, 'name', 180);
    $description = stringValue($data, 'description', 5000);
    $status = allowedValue(stringValue($data, 'status') ?: 'published', ['published','draft','archived'], 'sub-project status');
    $sortOrder = max(0, min(65535, (int)($data['sort_order'] ?? 0)));
    if ($projectId < 1 || $name === '') errorResponse('Project and sub-project name are required.');
    $check = $pdo->prepare('SELECT project_id FROM projects WHERE project_id=?'); $check->execute([$projectId]);
    if (!$check->fetchColumn()) errorResponse('The selected project no longer exists.', 404);
    $slug = seo_unique_slug($pdo, 'sub_projects', 'sub_project_id', 'slug', $name.' '.$projectId, $id);
    try {
        if ($id > 0) {
            $stmt = $pdo->prepare('UPDATE sub_projects SET project_id=?,name=?,slug=?,description=?,status=?,sort_order=? WHERE sub_project_id=?');
            $stmt->execute([$projectId,$name,$slug,$description ?: null,$status,$sortOrder,$id]);
            if (!$stmt->rowCount()) {
                $exists=$pdo->prepare('SELECT sub_project_id FROM sub_projects WHERE sub_project_id=?');$exists->execute([$id]);
                if (!$exists->fetch()) errorResponse('This sub-project no longer exists.',404);
            }
        } else {
            $stmt = $pdo->prepare('INSERT INTO sub_projects (project_id,name,slug,description,status,sort_order) VALUES (?,?,?,?,?,?)');
            $stmt->execute([$projectId,$name,$slug,$description ?: null,$status,$sortOrder]);
            $id = (int)$pdo->lastInsertId();
        }
        // A published child cannot be reachable while its parent remains a
        // draft. Keep both visibility states synchronized so newly saved
        // sub-project links work immediately on the public website.
        if ($status === 'published') {
            $publishParent = $pdo->prepare("UPDATE projects SET status='published' WHERE project_id=? AND status<>'published'");
            $publishParent->execute([$projectId]);
        }
        syncMasterOptionName($pdo,'subproject',$name);
        respond(['sub_project_id'=>$id,'project_id'=>$projectId,'status'=>$status]);
    } catch (PDOException $e) {
        if ((int)($e->errorInfo[1] ?? 0) === 1062) errorResponse('That sub-project already exists in this project.',409);
        throw $e;
    }
}

function deleteSubProject(array $data): void {
    requirePermission('subprojects.manage');
    $pdo=db(); ensureSubProjectsSchema($pdo);
    $id=(int)($data['sub_project_id']??0); if($id<1) errorResponse('A valid sub-project is required.');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE properties SET sub_project_id=NULL WHERE sub_project_id=?')->execute([$id]);
        $pdo->prepare('UPDATE payment_plans SET sub_project_id=NULL WHERE sub_project_id=?')->execute([$id]);
        $stmt=$pdo->prepare('DELETE FROM sub_projects WHERE sub_project_id=?');$stmt->execute([$id]);
        if(!$stmt->rowCount()){ $pdo->rollBack(); errorResponse('This sub-project no longer exists.',404); }
        $pdo->commit(); respond(['deleted'=>true]);
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
}

function paymentPlanById(PDO $pdo, ?string $planId): ?array {
    $planId = trim((string)$planId);
    if ($planId === '') return null;
    ensureSubProjectsSchema($pdo);
    $stmt = $pdo->prepare("SELECT pp.payment_plan_id AS plan_id,pp.project_id,pp.sub_project_id,pp.plan_name,pp.size_label,pp.booking_amount,pp.monthly_installment_count,pp.monthly_installment,pp.half_yearly_count,pp.half_yearly_installment,pp.balloting,pp.on_possession,pp.other_payment,pp.total_price,pp.full_payment_discount_percent,pp.half_payment_discount_percent,pp.preferred_location_charge_percent,sp.name AS sub_project_name FROM payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id WHERE pp.payment_plan_id=? AND pp.is_active=TRUE LIMIT 1");
    $stmt->execute([$planId]);
    $row=$stmt->fetch(); return $row ?: null;
}

function migrateLegacyPaymentPlans(PDO $pdo): void {
    if (!structuralColumnExists($pdo,'projects','payment_plans')) return;
    ensureSubProjectsSchema($pdo);
    $rows=$pdo->query("SELECT project_id,payment_plans FROM projects WHERE payment_plans IS NOT NULL AND TRIM(payment_plans) NOT IN ('','[]','null')")->fetchAll();
    if(!$rows)return;
    foreach($rows as $row){
        $plans=seo_decode_payment_plans((string)$row['payment_plans']);
        if($plans){
            try{syncPaymentPlansTable($pdo,(int)$row['project_id'],$plans);}catch(Throwable $e){error_log('[Heera legacy payment migration] '.$e->getMessage());continue;}
        }
        $pdo->prepare('UPDATE projects SET payment_plans=NULL WHERE project_id=?')->execute([(int)$row['project_id']]);
    }
}

function ensureAccessControlSchema(PDO $pdo): void {
    static $ready=[];$key=spl_object_id($pdo);if(!empty($ready[$key]))return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS roles (
        role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        role_key VARCHAR(60) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(500) DEFAULT NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS permissions (
        permission_key VARCHAR(100) PRIMARY KEY,
        label VARCHAR(160) NOT NULL,
        module_name VARCHAR(80) NOT NULL,
        description VARCHAR(500) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS role_permissions (
        role_id SMALLINT UNSIGNED NOT NULL,
        permission_key VARCHAR(100) NOT NULL,
        PRIMARY KEY(role_id,permission_key),
        INDEX idx_role_permission_key(permission_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if(!structuralColumnExists($pdo,'admin_users','role_id'))$pdo->exec('ALTER TABLE admin_users ADD COLUMN role_id SMALLINT UNSIGNED NULL AFTER phone');
    if(!structuralIndexExists($pdo,'admin_users','idx_admin_role'))$pdo->exec('ALTER TABLE admin_users ADD INDEX idx_admin_role(role_id)');

    $permissions = [
        ['dashboard.view','View dashboard','Dashboard'],
        ['properties.view','View properties','Properties'],['properties.manage','Manage properties','Properties'],
        ['projects.view','View projects','Projects'],['projects.manage','Manage projects','Projects'],
        ['subprojects.view','View sub-projects','Projects'],['subprojects.manage','Manage sub-projects','Projects'],
        ['payment_plans.view','View payment plans','Payments'],['payment_plans.manage','Manage payment plans','Payments'],
        ['crm.view','View CRM leads','CRM'],['crm.manage','Manage CRM leads','CRM'],
        ['submissions.view','View client submissions','Submissions'],['submissions.manage','Manage client submissions','Submissions'],
        ['maps.view','View maps','Maps'],['maps.manage','Manage maps','Maps'],
        ['gallery.manage','Manage gallery','Content'],['popups.manage','Manage popups','Content'],
        ['agents.view','View agents','Agents'],['agents.manage','Manage agents','Agents'],
        ['offices.manage','Manage offices','Settings'],['users.manage','Manage login users','Security'],
        ['roles.manage','Manage roles and permissions','Security'],['uploads.manage','Upload media','Media'],
        ['master_data.view','View reusable master data','Configuration'],['master_data.manage','Manage reusable master data','Configuration'],
        ['ai_advisor.use','Use AI property advisor','AI'],['system.health','View API/database health','System']
    ];
    $pstmt=$pdo->prepare('INSERT INTO permissions(permission_key,label,module_name) VALUES(?,?,?) ON DUPLICATE KEY UPDATE label=VALUES(label),module_name=VALUES(module_name)');
    foreach($permissions as $permission)$pstmt->execute($permission);

    $roles=[
        ['super_admin','Super Admin','Full system access.',1],
        ['manager','Manager','Manage inventory, projects, CRM, submissions, maps and team content.',1],
        ['agent','Agent','Work with CRM leads, properties, advisor and comparisons.',1],
        ['accountant','Accountant','View projects/payment plans and business records without content administration.',1],
        ['editor','Content Editor','Manage property/project and marketing content without user/security access.',1],
    ];
    $rstmt=$pdo->prepare('INSERT INTO roles(role_key,name,description,is_system) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),is_system=VALUES(is_system)');
    foreach($roles as $role)$rstmt->execute($role);

    $roleMap=[];foreach($pdo->query('SELECT role_id,role_key FROM roles')->fetchAll() as $r)$roleMap[$r['role_key']]=(int)$r['role_id'];
    $all=array_column($permissions,0);
    $grants=[
        'super_admin'=>$all,
        'manager'=>array_values(array_filter($all,fn($p)=>!in_array($p,['roles.manage'],true))),
        'agent'=>['dashboard.view','properties.view','projects.view','subprojects.view','payment_plans.view','crm.view','crm.manage','agents.view','master_data.view','ai_advisor.use'],
        'accountant'=>['dashboard.view','properties.view','projects.view','subprojects.view','payment_plans.view','crm.view','master_data.view','system.health'],
        'editor'=>['dashboard.view','properties.view','properties.manage','projects.view','projects.manage','subprojects.view','subprojects.manage','payment_plans.view','payment_plans.manage','maps.view','gallery.manage','popups.manage','agents.view','uploads.manage','master_data.view','master_data.manage'],
    ];
    $insert=$pdo->prepare('INSERT IGNORE INTO role_permissions(role_id,permission_key) VALUES(?,?)');
    foreach($grants as $roleKey=>$keys){
        if(empty($roleMap[$roleKey]))continue;
        $roleId=$roleMap[$roleKey];
        $countStmt=$pdo->prepare('SELECT COUNT(*) FROM role_permissions WHERE role_id=?');$countStmt->execute([$roleId]);$existingGrantCount=(int)$countStmt->fetchColumn();
        if($roleKey!=='super_admin' && $existingGrantCount>0) continue; // preserve admin-customized system roles
        foreach($keys as $perm)$insert->execute([$roleId,$perm]);
    }
    // Add only the two new Master Data grants to existing built-in roles. This
    // does not remove or rewrite any administrator-customized permission.
    foreach(['manager','editor'] as $roleKey){if(!empty($roleMap[$roleKey])){foreach(['master_data.view','master_data.manage'] as $perm)$insert->execute([$roleMap[$roleKey],$perm]);}}
    foreach(['agent','accountant'] as $roleKey){if(!empty($roleMap[$roleKey]))$insert->execute([$roleMap[$roleKey],'master_data.view']);}

    if(!empty($roleMap['super_admin']))$pdo->prepare('UPDATE admin_users SET role_id=? WHERE role_id IS NULL')->execute([$roleMap['super_admin']]);
    structuralAddForeignKey($pdo,'role_permissions','fk_role_permissions_role','role_id','roles','role_id','CASCADE');
    structuralAddForeignKey($pdo,'role_permissions','fk_role_permissions_permission','permission_key','permissions','permission_key','CASCADE');
    structuralAddForeignKey($pdo,'admin_users','fk_admin_role','role_id','roles','role_id','SET NULL');
    $ready[$key]=true;
}

function ensureMasterOptionsSchema(PDO $pdo): void {
    static $ready=[];$key=spl_object_id($pdo);if(!empty($ready[$key]))return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS master_options (
        option_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        option_type ENUM('project','subproject','block','marla') NOT NULL,
        name VARCHAR(180) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_master_option_type_name(option_type,name),
        INDEX idx_master_option_list(option_type,is_active,sort_order,name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $seed=static function(string $type,string $select)use($pdo):void{try{$pdo->exec("INSERT IGNORE INTO master_options(option_type,name) {$select}");}catch(Throwable $e){error_log('[Heera master data seed]['.$type.'] '.$e->getMessage());}};
    if(structuralTableExists($pdo,'projects'))$seed('project',"SELECT 'project',TRIM(title) FROM projects WHERE title IS NOT NULL AND TRIM(title)<>''");
    if(structuralTableExists($pdo,'sub_projects'))$seed('subproject',"SELECT 'subproject',TRIM(name) FROM sub_projects WHERE name IS NOT NULL AND TRIM(name)<>''");
    if(structuralTableExists($pdo,'properties')){
        $seed('block',"SELECT 'block',TRIM(block_name) FROM properties WHERE block_name IS NOT NULL AND TRIM(block_name)<>''");
        $seed('marla',"SELECT 'marla',TRIM(size_label) FROM properties WHERE size_label IS NOT NULL AND TRIM(size_label)<>''");
    }
    if(structuralTableExists($pdo,'digital_map_blocks'))$seed('block',"SELECT 'block',TRIM(name) FROM digital_map_blocks WHERE name IS NOT NULL AND TRIM(name)<>''");
    if(structuralTableExists($pdo,'payment_plans'))$seed('marla',"SELECT 'marla',TRIM(size_label) FROM payment_plans WHERE size_label IS NOT NULL AND TRIM(size_label)<>''");
    $ready[$key]=true;
}

function masterOptions(bool $includeInactive=true): array {
    requirePermission('master_data.view');
    $pdo=db();ensureMasterOptionsSchema($pdo);
    $rows=heeraStoredRows($pdo,'heera_v4_master_options',[$includeInactive?1:0]);
    if($rows===null){$sql='SELECT option_id,option_type,name,is_active,sort_order,created_at,updated_at FROM master_options'.($includeInactive?'':' WHERE is_active=TRUE').' ORDER BY FIELD(option_type,\'project\',\'subproject\',\'block\',\'marla\'),sort_order,name,option_id';$rows=$pdo->query($sql)->fetchAll();}
    return $rows;
}

function syncMasterOptionName(PDO $pdo,string $type,string $name): void {
    $name=trim($name);if($name===''||!in_array($type,['project','subproject','block','marla'],true))return;
    try{ensureMasterOptionsSchema($pdo);$stmt=$pdo->prepare('INSERT IGNORE INTO master_options(option_type,name) VALUES(?,?)');$stmt->execute([$type,$name]);}
    catch(Throwable $e){error_log('[Heera master data sync] '.$e->getMessage());}
}

function saveMasterOption(array $data): void {
    requirePermission('master_data.manage');
    $pdo=db();ensureMasterOptionsSchema($pdo);
    $id=(int)($data['option_id']??0);
    $type=allowedValue(strtolower(stringValue($data,'option_type',20)),['project','subproject','block','marla'],'master data type');
    $limit=['project'=>180,'subproject'=>180,'block'=>120,'marla'=>60][$type];
    $name=stringValue($data,'name',$limit);if($name==='')errorResponse('Option name is required.');
    $active=array_key_exists('is_active',$data)?(!empty($data['is_active'])?1:0):1;
    $sort=max(0,min(65535,(int)($data['sort_order']??0)));
    try{
        if($id>0){$stmt=$pdo->prepare('UPDATE master_options SET option_type=?,name=?,is_active=?,sort_order=? WHERE option_id=?');$stmt->execute([$type,$name,$active,$sort,$id]);if(!$stmt->rowCount()){$check=$pdo->prepare('SELECT option_id FROM master_options WHERE option_id=?');$check->execute([$id]);if(!$check->fetch())errorResponse('Master-data option not found.',404);}}
        else{$stmt=$pdo->prepare('INSERT INTO master_options(option_type,name,is_active,sort_order) VALUES(?,?,?,?)');$stmt->execute([$type,$name,$active,$sort]);$id=(int)$pdo->lastInsertId();}
        respond(['option_id'=>$id,'saved'=>true]);
    }catch(PDOException $e){if((int)($e->errorInfo[1]??0)===1062)errorResponse('That option already exists in this category.',409);throw $e;}
}

function archiveMasterOption(array $data): void {
    requirePermission('master_data.manage');
    $pdo=db();ensureMasterOptionsSchema($pdo);$id=(int)($data['option_id']??0);if($id<1)errorResponse('Choose a valid master-data option.');
    $stmt=$pdo->prepare('UPDATE master_options SET is_active=FALSE WHERE option_id=?');$stmt->execute([$id]);
    if(!$stmt->rowCount()){$check=$pdo->prepare('SELECT option_id FROM master_options WHERE option_id=?');$check->execute([$id]);if(!$check->fetch())errorResponse('Master-data option not found.',404);}
    respond(['archived'=>true,'option_id'=>$id]);
}

function adminPermissionsForUser(PDO $pdo, int $adminId): array {
    if(($_SESSION['heera_schema_session']??'')!=='master-data-v2')ensureAccessControlSchema($pdo);
    $stmt=$pdo->prepare("SELECT DISTINCT rp.permission_key FROM admin_users a JOIN roles r ON r.role_id=a.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.role_id WHERE a.admin_id=? ORDER BY rp.permission_key");
    $stmt->execute([$adminId]);
    return array_values(array_filter(array_map('strval',array_column($stmt->fetchAll(),'permission_key'))));
}

function adminHasPermission(array $admin, string $permission): bool {
    if (($admin['role_key'] ?? '') === 'super_admin') return true;
    return in_array($permission, (array)($admin['permissions'] ?? []), true);
}

function requirePermission(string $permission): array {
    $admin=currentAdmin();
    if(!$admin)errorResponse('Please log in to manage this area.',401);
    if(!adminHasPermission($admin,$permission))errorResponse('Your role does not have permission to perform this action.',403);
    return $admin;
}

function rolesAndPermissions(): array {
    requirePermission('roles.manage');
    $pdo=db();ensureAccessControlSchema($pdo);
    $permissions=heeraStoredRows($pdo,'heera_v4_permissions')??$pdo->query('SELECT permission_key,label,module_name,description FROM permissions ORDER BY module_name,label')->fetchAll();
    $roles=heeraStoredRows($pdo,'heera_v4_roles')??$pdo->query("SELECT r.role_id,r.role_key,r.name,r.description,r.is_system,(SELECT COUNT(*) FROM admin_users a WHERE a.role_id=r.role_id) AS user_count FROM roles r ORDER BY r.is_system DESC,r.name")->fetchAll();
    $storedRolePermissions=heeraStoredRows($pdo,'heera_v4_role_permissions');
    if ($storedRolePermissions !== null) {
        $byRole=[];foreach($storedRolePermissions as $grant)$byRole[(int)$grant['role_id']][]=$grant['permission_key'];
        foreach($roles as &$role)$role['permissions']=$byRole[(int)$role['role_id']]??[];
        return ['roles'=>$roles,'permissions'=>$permissions];
    }
    $stmt=$pdo->prepare('SELECT permission_key FROM role_permissions WHERE role_id=? ORDER BY permission_key');
    foreach($roles as &$role){$stmt->execute([(int)$role['role_id']]);$role['permissions']=array_column($stmt->fetchAll(),'permission_key');}
    return ['roles'=>$roles,'permissions'=>$permissions];
}

function saveRole(array $data): void {
    $admin=requirePermission('roles.manage');$pdo=db();ensureAccessControlSchema($pdo);
    $id=(int)($data['role_id']??0);$name=stringValue($data,'name',100);$key=strtolower(trim((string)($data['role_key']??'')));$description=stringValue($data,'description',500);
    $permissions=is_array($data['permissions']??null)?array_values(array_unique(array_map('strval',$data['permissions']))):[];
    if($name==='')errorResponse('Role name is required.');
    if($key==='')$key=preg_replace('/[^a-z0-9]+/','_',strtolower($name))?:'custom_role';
    if(!preg_match('/^[a-z][a-z0-9_]{2,59}$/',$key))errorResponse('Role key must use lowercase letters, numbers and underscores.');
    $existing=null;if($id>0){$s=$pdo->prepare('SELECT * FROM roles WHERE role_id=?');$s->execute([$id]);$existing=$s->fetch();if(!$existing)errorResponse('Role not found.',404);if($existing['role_key']==='super_admin'&&($admin['role_key']??'')!=='super_admin')errorResponse('Only Super Admin can edit the Super Admin role.',403);}
    $pdo->beginTransaction();
    try{
        if($id>0){$stmt=$pdo->prepare('UPDATE roles SET role_key=?,name=?,description=? WHERE role_id=?');$stmt->execute([$key,$name,$description?:null,$id]);}
        else{$stmt=$pdo->prepare('INSERT INTO roles(role_key,name,description,is_system) VALUES(?,?,?,FALSE)');$stmt->execute([$key,$name,$description?:null]);$id=(int)$pdo->lastInsertId();}
        if($key!=='super_admin'){
            $valid=array_column($pdo->query('SELECT permission_key FROM permissions')->fetchAll(),'permission_key');
            $permissions=array_values(array_intersect($permissions,$valid));
            $pdo->prepare('DELETE FROM role_permissions WHERE role_id=?')->execute([$id]);
            $ins=$pdo->prepare('INSERT INTO role_permissions(role_id,permission_key) VALUES(?,?)');foreach($permissions as $perm)$ins->execute([$id,$perm]);
        }
        $pdo->commit();respond(['role_id'=>$id]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException&&(int)($e->errorInfo[1]??0)===1062)errorResponse('That role key already exists.',409);throw $e;}
}

function deleteRole(array $data): void {
    requirePermission('roles.manage');$pdo=db();ensureAccessControlSchema($pdo);$id=(int)($data['role_id']??0);if($id<1)errorResponse('A valid role is required.');
    $stmt=$pdo->prepare('SELECT role_key,is_system FROM roles WHERE role_id=?');$stmt->execute([$id]);$role=$stmt->fetch();if(!$role)errorResponse('Role not found.',404);if($role['is_system'])errorResponse('System roles cannot be deleted.',409);
    $count=$pdo->prepare('SELECT COUNT(*) FROM admin_users WHERE role_id=?');$count->execute([$id]);if((int)$count->fetchColumn()>0)errorResponse('Reassign users before deleting this role.',409);
    $pdo->prepare('DELETE FROM roles WHERE role_id=?')->execute([$id]);respond(['deleted'=>true]);
}

function adminCapabilitiesFromPermissions(array $admin): array {
    $has=fn(string $p):bool=>adminHasPermission($admin,$p);
    return [
        'dashboard'=>$has('dashboard.view'),'properties'=>$has('properties.view'),'properties_manage'=>$has('properties.manage'),
        'projects'=>$has('projects.view'),'projects_manage'=>$has('projects.manage'),'subprojects'=>$has('subprojects.view'),'subprojects_manage'=>$has('subprojects.manage'),
        'payment_plans'=>$has('payment_plans.view'),'payment_plans_manage'=>$has('payment_plans.manage'),'leads'=>$has('crm.view'),'leads_manage'=>$has('crm.manage'),
        'submissions'=>$has('submissions.view'),'submissions_manage'=>$has('submissions.manage'),'digital_maps'=>$has('maps.view'),'maps_manage'=>$has('maps.manage'),
        'gallery'=>$has('gallery.manage'),'popups'=>$has('popups.manage'),'agents'=>$has('agents.view'),'agents_manage'=>$has('agents.manage'),
        'offices'=>$has('offices.manage'),'users'=>$has('users.manage'),'roles'=>$has('roles.manage'),
        'master_data'=>$has('master_data.view'),'master_data_manage'=>$has('master_data.manage'),
        'uploads'=>$has('uploads.manage'),'ai_property_advisor'=>$has('ai_advisor.use'),'health'=>$has('system.health')
    ];
}

function ensureRelationalIntegrity(PDO $pdo): array {
    ensureSubProjectsSchema($pdo);ensureAccessControlSchema($pdo);ensurePaymentPlansTable($pdo);migrateLegacyPaymentPlans($pdo);
    $repairs=[];
    // Orphan cleanup is intentionally non-destructive: invalid optional links become NULL.
    foreach([
        "UPDATE properties pr LEFT JOIN projects p ON p.project_id=pr.project_id SET pr.project_id=NULL WHERE pr.project_id IS NOT NULL AND p.project_id IS NULL"=>'properties.project_id',
        "UPDATE properties pr LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id SET pr.sub_project_id=NULL WHERE pr.sub_project_id IS NOT NULL AND sp.sub_project_id IS NULL"=>'properties.sub_project_id',
        "UPDATE properties pr LEFT JOIN payment_plans pp ON pp.payment_plan_id=pr.payment_plan_id SET pr.payment_plan_id=NULL WHERE pr.payment_plan_id IS NOT NULL AND pp.payment_plan_id IS NULL"=>'properties.payment_plan_id',
        "UPDATE payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id SET pp.sub_project_id=NULL WHERE pp.sub_project_id IS NOT NULL AND (sp.sub_project_id IS NULL OR sp.project_id<>pp.project_id)"=>'payment_plans.sub_project_id',
    ] as $sql=>$name){try{$count=$pdo->exec($sql);$repairs[$name]=(int)$count;}catch(Throwable $e){$repairs[$name]='skipped';}}

    structuralAddForeignKey($pdo,'sub_projects','fk_sub_project_project','project_id','projects','project_id','CASCADE');
    structuralAddForeignKey($pdo,'payment_plans','fk_payment_plan_project','project_id','projects','project_id','CASCADE');
    structuralAddForeignKey($pdo,'payment_plans','fk_payment_plan_sub_project','sub_project_id','sub_projects','sub_project_id','SET NULL');
    structuralAddForeignKey($pdo,'properties','fk_property_project','project_id','projects','project_id','SET NULL');
    structuralAddForeignKey($pdo,'properties','fk_property_sub_project','sub_project_id','sub_projects','sub_project_id','SET NULL');
    structuralAddForeignKey($pdo,'properties','fk_property_payment_plan','payment_plan_id','payment_plans','payment_plan_id','SET NULL');
    return $repairs;
}

function relationalHealth(PDO $pdo): array {
    $expected=[
        ['sub_projects','fk_sub_project_project'],['payment_plans','fk_payment_plan_project'],['payment_plans','fk_payment_plan_sub_project'],
        ['properties','fk_property_project'],['properties','fk_property_sub_project'],['properties','fk_property_payment_plan'],
        ['admin_users','fk_admin_role'],['role_permissions','fk_role_permissions_role'],['role_permissions','fk_role_permissions_permission']
    ];
    $out=[];foreach($expected as [$table,$fk])$out[$fk]=structuralForeignKeyExists($pdo,$table,$fk);return $out;
}

function permissionForAdminRoute(string $route): ?string {
    $route = trim(strtolower($route), '/');
    $map = [
        'dashboard'=>'dashboard.view','health'=>'system.health','system/health'=>'system.health',
        'properties'=>'properties.view','properties/save'=>'properties.manage','properties/delete'=>'properties.manage',
        'projects'=>'projects.view','projects/save'=>'projects.manage','projects/delete'=>'projects.manage',
        'sub-projects'=>'subprojects.view','sub-projects/save'=>'subprojects.manage','sub-projects/delete'=>'subprojects.manage',
        'payment-plans'=>'payment_plans.view',
        'crm/leads'=>'crm.view','leads'=>'crm.view','crm/stats'=>'crm.view','crm/leads/create'=>'crm.manage','crm/leads/update'=>'crm.manage','leads/status'=>'crm.manage',
        'submissions'=>'submissions.view','submissions/save'=>'submissions.manage','submissions/approve'=>'submissions.manage',
        'maps'=>'maps.view','maps/save'=>'maps.manage','maps/delete'=>'maps.manage','maps/blocks/save'=>'maps.manage','maps/blocks/delete'=>'maps.manage',
        'gallery'=>'gallery.manage','gallery/save'=>'gallery.manage','gallery/delete'=>'gallery.manage',
        'popups'=>'popups.manage','popups/save'=>'popups.manage','popups/delete'=>'popups.manage',
        'agents'=>'agents.view','agents/save'=>'agents.manage','agents/delete'=>'agents.manage',
        'advisor/recommend'=>'ai_advisor.use','advisor/history'=>'ai_advisor.use',
        'offices'=>'offices.manage','offices/save'=>'offices.manage','offices/delete'=>'offices.manage',
        'users'=>'users.manage','users/save'=>'users.manage','users/delete'=>'users.manage','role-options'=>'users.manage',
        'roles'=>'roles.manage','roles/save'=>'roles.manage','roles/delete'=>'roles.manage',
        'master-data'=>'master_data.view','master-data/save'=>'master_data.manage','master-data/archive'=>'master_data.manage',
        'upload'=>'uploads.manage',
    ];
    return $map[$route] ?? null;
}

function permissionForLegacyAction(string $action): ?string {
    $action = trim(strtolower($action));
    $aliases = [
        'admin_dashboard'=>'dashboard','admin_properties'=>'properties','save_property'=>'properties/save','delete_property'=>'properties/delete',
        'admin_projects'=>'projects','save_project'=>'projects/save','delete_project'=>'projects/delete',
        'admin_sub_projects'=>'sub-projects','save_sub_project'=>'sub-projects/save','delete_sub_project'=>'sub-projects/delete','admin_payment_plans'=>'payment-plans',
        'admin_enquiries'=>'crm/leads','admin_crm_leads'=>'crm/leads','crm_stats'=>'crm/stats','crm_create_lead'=>'crm/leads/create','save_enquiry_status'=>'crm/leads/update','save_crm_lead'=>'crm/leads/update',
        'admin_submissions'=>'submissions','save_submission'=>'submissions/save','approve_submission'=>'submissions/approve',
        'admin_digital_maps'=>'maps','save_digital_map'=>'maps/save','delete_digital_map'=>'maps/delete','save_digital_map_block'=>'maps/blocks/save','delete_digital_map_block'=>'maps/blocks/delete',
        'admin_home_gallery'=>'gallery','save_home_gallery'=>'gallery/save','delete_home_gallery'=>'gallery/delete','admin_popups'=>'popups','save_popup'=>'popups/save','delete_popup'=>'popups/delete',
        'admin_agents'=>'agents','save_agent'=>'agents/save','delete_agent'=>'agents/delete','admin_office_addresses'=>'offices','save_office_address'=>'offices/save','delete_office_address'=>'offices/delete',
        'admin_login_users'=>'users','save_login_user'=>'users/save','delete_login_user'=>'users/delete','admin_role_options'=>'role-options','admin_roles'=>'roles','save_role'=>'roles/save','delete_role'=>'roles/delete',
        'admin_master_data'=>'master-data','save_master_option'=>'master-data/save','archive_master_option'=>'master-data/archive','upload'=>'upload'
    ];
    return permissionForAdminRoute($aliases[$action] ?? $action);
}

function roleOptions(): array {
    requirePermission('users.manage');
    $pdo=db();ensureAccessControlSchema($pdo);
    $roles=heeraStoredRows($pdo,'heera_v4_roles');
    if($roles!==null)return array_map(static fn(array $role):array=>['role_id'=>$role['role_id'],'role_key'=>$role['role_key'],'name'=>$role['name']],$roles);
    return $pdo->query('SELECT role_id,role_key,name FROM roles ORDER BY is_system DESC,name')->fetchAll();
}
