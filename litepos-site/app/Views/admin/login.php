<section class="admin-login-wrap">
    <form class="admin-login-card" method="post" action="<?= e(url('/admin/login')) ?>">
        <a class="brand" href="<?= e(url('/')) ?>"><img src="<?= e(url('/assets/images/logo.png')) ?>" alt="LitePOS" width="170" height="56"></a>
        <h1>Masuk admin</h1>
        <p>Kelola pesanan dan penerbitan lisensi manual.</p>
        <input type="hidden" name="_csrf" value="<?= e(\LitePOS\Core\Security::csrfToken()) ?>">
        <?php if (!empty($error)): ?><div class="alert alert-error" role="alert"><?= e($error) ?></div><?php endif; ?>
        <label class="field"><span>Email admin</span><input type="email" name="email" autocomplete="username" required></label>
        <label class="field"><span>Kata sandi</span><input type="password" name="password" autocomplete="current-password" minlength="12" required></label>
        <button class="button button-accent button-block" type="submit">Masuk</button>
        <a class="text-link admin-back" href="<?= e(url('/')) ?>">← Kembali ke website</a>
    </form>
</section>
