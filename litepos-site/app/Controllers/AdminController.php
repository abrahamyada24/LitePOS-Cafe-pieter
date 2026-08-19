<?php

declare(strict_types=1);

namespace LitePOS\Controllers;

use LitePOS\Core\Database;
use LitePOS\Core\RateLimiter;
use LitePOS\Core\Security;
use LitePOS\Core\View;
use LitePOS\Services\LegacyLicense;
use LitePOS\Services\LicenseService;
use RuntimeException;

final class AdminController
{
    public function loginForm(): void
    {
        header('Cache-Control: no-store, private');
        if ($this->isAuthenticated()) {
            Security::redirect('/admin');
        }
        View::render('admin/login', [
            'title' => 'Admin LitePOS',
            'error' => $_SESSION['admin_error'] ?? null,
        ]);
        unset($_SESSION['admin_error']);
    }

    public function login(): void
    {
        Security::requireCsrf();
        if (!RateLimiter::hit('admin-login', 5, 900)) {
            $_SESSION['admin_error'] = 'Terlalu banyak percobaan. Tunggu 15 menit.';
            Security::redirect('/admin/login');
        }

        $email = strtolower(trim(is_string($_POST['email'] ?? null) ? $_POST['email'] : ''));
        $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
        $expectedEmail = strtolower(trim((string) env('ADMIN_EMAIL', '')));
        $hash = (string) env('ADMIN_PASSWORD_HASH', '');
        if ($expectedEmail === '' || $hash === '' || !hash_equals($expectedEmail, $email) || !password_verify($password, $hash)) {
            usleep(random_int(150000, 350000));
            $_SESSION['admin_error'] = 'Email atau kata sandi salah.';
            Security::redirect('/admin/login');
        }

        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['admin_last_seen'] = time();
        $_SESSION['admin_agent'] = hash('sha256', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        Security::redirect('/admin');
    }

    public function logout(): void
    {
        Security::requireCsrf();
        $_SESSION = [];
        session_regenerate_id(true);
        Security::redirect('/admin/login');
    }

    public function dashboard(): void
    {
        header('Cache-Control: no-store, private');
        $this->requireAuth();
        $pdo = Database::connection();
        $counts = [
            'paid' => (int) $pdo->query("SELECT COUNT(*) FROM license_orders WHERE status = 'paid'")->fetchColumn(),
            'pending' => (int) $pdo->query("SELECT COUNT(*) FROM license_orders WHERE status = 'pending'")->fetchColumn(),
            'licenses' => (int) $pdo->query('SELECT COUNT(*) FROM licenses')->fetchColumn(),
            'revenue' => (int) $pdo->query("SELECT COALESCE(SUM(amount), 0) FROM license_orders WHERE status = 'paid'")->fetchColumn(),
        ];
        $orders = $pdo->query('SELECT * FROM license_orders ORDER BY id DESC LIMIT 30')->fetchAll();
        $licenses = $pdo->query('SELECT * FROM licenses ORDER BY id DESC LIMIT 30')->fetchAll();

        View::render('admin/dashboard', [
            'title' => 'Dashboard Lisensi',
            'counts' => $counts,
            'orders' => $orders,
            'licenses' => $licenses,
            'supportedDays' => LegacyLicense::SUPPORTED_DAYS,
            'generated' => $_SESSION['generated_license'] ?? null,
            'error' => $_SESSION['admin_error'] ?? null,
        ]);
        unset($_SESSION['generated_license'], $_SESSION['admin_error']);
    }

    public function createLicense(): void
    {
        $this->requireAuth();
        Security::requireCsrf();
        if (!RateLimiter::hit('admin-license-create', 20, 300)) {
            $_SESSION['admin_error'] = 'Terlalu banyak token dibuat. Coba lagi beberapa menit.';
            Security::redirect('/admin');
        }

        $storeId = Security::sanitizeStoreId(is_string($_POST['store_id'] ?? null) ? $_POST['store_id'] : '');
        $days = (int) ($_POST['duration_days'] ?? 0);
        $maxDevices = (int) ($_POST['max_devices'] ?? 1);
        try {
            $license = (new LicenseService())->issueManual($storeId, $days, $maxDevices);
            $_SESSION['generated_license'] = [
                'store_id' => $license['store_id'],
                'duration_days' => (int) $license['duration_days'],
                'activation_code' => $license['activation_code'],
                'license_key' => $license['license_key'],
            ];
        } catch (RuntimeException $error) {
            $_SESSION['admin_error'] = $error->getMessage();
        }
        Security::redirect('/admin');
    }

    private function requireAuth(): void
    {
        if (!$this->isAuthenticated()) {
            $_SESSION['admin_error'] = 'Silakan masuk kembali.';
            Security::redirect('/admin/login');
        }
        $_SESSION['admin_last_seen'] = time();
    }

    private function isAuthenticated(): bool
    {
        $authenticated = ($_SESSION['admin_authenticated'] ?? false) === true;
        $lastSeen = (int) ($_SESSION['admin_last_seen'] ?? 0);
        $agent = hash('sha256', (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        $agentMatches = is_string($_SESSION['admin_agent'] ?? null) && hash_equals($_SESSION['admin_agent'], $agent);
        if (!$authenticated || !$agentMatches || $lastSeen < time() - 1800) {
            unset($_SESSION['admin_authenticated'], $_SESSION['admin_last_seen'], $_SESSION['admin_agent']);
            return false;
        }
        return true;
    }
}
