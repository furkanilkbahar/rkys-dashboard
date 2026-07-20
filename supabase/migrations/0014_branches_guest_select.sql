-- Bug fix: effective_menu_items view (0010) product/variant fiyat-stok
-- fan-out'u için public.branches'a join eder; 0007'nin is_staff() sertleşmesi
-- misafirin HİÇBİR branches satırını görememesine yol açtı (inner join sıfır
-- satır döndürdü), bu da menüdeki her ürünü yanlışlıkla "tükendi" gösterdi.
-- Misafir yalnızca KENDİ branch_id'sini (current_guest_branch_id, 0011)
-- görebilsin diye ayrı, dar kapsamlı bir SELECT politikası eklenir — genel
-- "tüm şubeleri listele" erişimi hâlâ yalnızca personelde kalır.
create policy "branches_guest_select_own" on public.branches for select
  using (id = public.current_guest_branch_id());
