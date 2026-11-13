<?php
// Configuracao por variaveis de ambiente. Nunca publique senhas de SQL Server,
// tokens de pagamento ou chaves privadas nos arquivos do GitHub.
function ddtankEnv($name, $fallback = '') {
    $value = getenv($name);
    return $value === false ? $fallback : $value;
}
define('DB_CONNECTION', 'sqlsrv');
define('DB_HOST', ddtankEnv('DDTANK_SQL_HOST'));
define('DB_DATABASE', ddtankEnv('DDTANK_SQL_DATABASE'));
define('DB_USERNAME', ddtankEnv('DDTANK_SQL_USER'));
define('DB_PASSWORD', ddtankEnv('DDTANK_SQL_PASSWORD'));
define('KEY_REQUEST', ddtankEnv('DDTANK_LEGACY_REQUEST_KEY'));

define('ConfigXu', 1);
define('VersionLauncher', '3.3.3.49');
define('SiteName', 'DDTank PT-BR');
define('SupportUrl', '');
define('CheckOnlineChuyenXu', false);

define('PartnerIDTheSieuRe', ddtankEnv('DDTANK_PAYMENT_PARTNER_ID'));
define('PartnerKeyTheSieuRe', ddtankEnv('DDTANK_PAYMENT_PARTNER_KEY'));
define('MOMO_PHONE_NUMBER', ddtankEnv('DDTANK_PAYMENT_PHONE'));
define('MOMO_ACCOUNT_NAME', ddtankEnv('DDTANK_PAYMENT_NAME'));
define('MOMO_API_KEY', ddtankEnv('DDTANK_PAYMENT_API_KEY'));
?>