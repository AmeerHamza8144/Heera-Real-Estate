<?php
declare(strict_types=1);
$root=dirname(__DIR__);$fail=[];
function v5check(bool $ok,string $message):void{global $fail;echo ($ok?'[PASS] ':'[FAIL] ').$message.PHP_EOL;if(!$ok)$fail[]=$message;}
function v5read(string $file):string{$v=@file_get_contents($file);return is_string($v)?$v:'';}
$db=v5read($root.'/database.sql');$api=v5read($root.'/api.php');$core=v5read($root.'/api-core.php');$platform=v5read($root.'/platform-v5.php');$admin=v5read($root.'/admin.html');$home=v5read($root.'/index.html');$siteNav=v5read($root.'/site-nav.js');
v5check(is_file($root.'/platform-v5-migration.sql'),'Platform v5 database migration is included');
foreach(['saved_searches','site_visits','crm_activities','property_price_history','audit_logs','password_reset_tokens'] as $table)v5check(str_contains($db,'CREATE TABLE '.$table),'database.sql defines '.$table);
foreach(['client_dashboard','toggle_saved_property','save_saved_search','book_site_visit','admin_site_visits','crm_activities','admin_reports','admin_audit_logs','reset_password'] as $action)v5check(str_contains($api,"case '".$action."'"),'API exposes '.$action);
v5check(str_contains($core,"require_once __DIR__ . \"/platform-v5.php\""),'API core loads Platform v5 services');
v5check(str_contains($admin,'id="siteVisitsWorkspace"')&&str_contains($admin,'id="reportsWorkspace"')&&str_contains($admin,'id="auditWorkspace"'),'Admin contains new non-map workspaces');
v5check(str_contains($siteNav,'client-dashboard.html'),'Profile menu links the client dashboard');
v5check(str_contains($home,'id="saveCurrentSearch"'),'Homepage supports saved searches');
v5check(is_file($root.'/client-dashboard.html')&&is_file($root.'/reset-password.html'),'Client dashboard and password reset pages are included');
v5check(str_contains($platform,'platformRecordPropertyChange')&&str_contains($platform,'platformAudit'),'Price history and audit services are active');
if($fail){fwrite(STDERR,"\nPlatform v5 contract failures: ".count($fail)."\n");exit(1);}echo "\nAll Platform v5 contracts passed.\n";
