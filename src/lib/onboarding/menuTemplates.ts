export type MenuTemplateProduct = {
  slug: string;
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  descriptionEn: string;
  priceMinor: number;
};

export type MenuTemplateCategory = {
  nameTr: string;
  nameEn: string;
  products: MenuTemplateProduct[];
};

export type MenuTemplateKey = "cafe" | "restaurant" | "patisserie";

export type MenuTemplate = {
  key: MenuTemplateKey;
  categories: MenuTemplateCategory[];
};

export const MENU_TEMPLATE_KEYS: MenuTemplateKey[] = ["cafe", "restaurant", "patisserie"];

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    key: "cafe",
    categories: [
      {
        nameTr: "Kahveler",
        nameEn: "Coffees",
        products: [
          { slug: "flat-white", nameTr: "Flat White", nameEn: "Flat White", descriptionTr: "Yoğun espresso ve kadifemsi buharlanmış süt.", descriptionEn: "Rich espresso with velvety steamed milk.", priceMinor: 15000 },
          { slug: "cortado", nameTr: "Cortado", nameEn: "Cortado", descriptionTr: "Eşit oranda espresso ve ılık süt.", descriptionEn: "Equal parts espresso and warm milk.", priceMinor: 14000 },
          { slug: "v60-filtre", nameTr: "V60 Filtre Kahve", nameEn: "V60 Pour-Over Coffee", descriptionTr: "Elde demlenmiş, tek kaynak özel çekirdek.", descriptionEn: "Hand-brewed single-origin specialty beans.", priceMinor: 16000 },
          { slug: "karamelli-latte", nameTr: "Karamelli Latte", nameEn: "Caramel Latte", descriptionTr: "Ev yapımı karamel soslu kremamsı latte.", descriptionEn: "Creamy latte with house-made caramel sauce.", priceMinor: 17000 },
        ],
      },
      {
        nameTr: "Tatlılar",
        nameEn: "Desserts",
        products: [
          { slug: "cikolatali-sufle", nameTr: "Fransız Çikolatalı Sufle", nameEn: "French Chocolate Soufflé", descriptionTr: "Sıcak servis edilen, akışkan çikolata dolgulu sufle.", descriptionEn: "Warm-served soufflé with a molten chocolate center.", priceMinor: 24000 },
          { slug: "ny-cheesecake", nameTr: "New York Cheesecake", nameEn: "New York Cheesecake", descriptionTr: "Klasik tarz, kremamsı ve yoğun cheesecake.", descriptionEn: "Classic-style creamy and rich cheesecake.", priceMinor: 21000 },
          { slug: "limonlu-tart", nameTr: "Limonlu Tart", nameEn: "Lemon Tart", descriptionTr: "Ferahlatıcı limon kreması ile gevrek tart tabanı.", descriptionEn: "Refreshing lemon curd on a crisp tart base.", priceMinor: 19000 },
          { slug: "tiramisu", nameTr: "Tiramisu", nameEn: "Tiramisu", descriptionTr: "Mascarpone ve espresso ile İtalyan klasiği.", descriptionEn: "Italian classic with mascarpone and espresso.", priceMinor: 20000 },
        ],
      },
      {
        nameTr: "Soğuk İçecekler",
        nameEn: "Cold Drinks",
        products: [
          { slug: "cold-brew", nameTr: "Cold Brew", nameEn: "Cold Brew", descriptionTr: "12 saat soğuk demlenmiş, yumuşak içimli kahve.", descriptionEn: "12-hour cold-steeped, smooth-bodied coffee.", priceMinor: 15000 },
          { slug: "frozen-frappuccino", nameTr: "Frozen Frappuccino", nameEn: "Frozen Frappuccino", descriptionTr: "Buzla çırpılmış kremamsı soğuk kahve içeceği.", descriptionEn: "Blended creamy iced coffee drink.", priceMinor: 18000 },
          { slug: "ev-limonata", nameTr: "Ev Yapımı Limonata", nameEn: "House-Made Lemonade", descriptionTr: "Taze sıkılmış limon ve nane ile serinletici.", descriptionEn: "Refreshing fresh-squeezed lemon with mint.", priceMinor: 12000 },
          { slug: "meyveli-ice-tea", nameTr: "Meyveli Ice Tea", nameEn: "Fruit Iced Tea", descriptionTr: "Taze meyvelerle demlenmiş buzlu çay.", descriptionEn: "Iced tea steeped with fresh fruit.", priceMinor: 13000 },
        ],
      },
      {
        nameTr: "Kahvaltılıklar",
        nameEn: "Breakfast",
        products: [
          { slug: "avokadolu-tost", nameTr: "Avokadolu Tost", nameEn: "Avocado Toast", descriptionTr: "Ezme avokado, cherry domates ve chili flakes.", descriptionEn: "Smashed avocado, cherry tomatoes, and chili flakes.", priceMinor: 19000 },
          { slug: "somonlu-bagel", nameTr: "Somonlu Bagel", nameEn: "Salmon Bagel", descriptionTr: "Füme somon, krem peynir ve taze dereotu.", descriptionEn: "Smoked salmon, cream cheese, and fresh dill.", priceMinor: 24000 },
          { slug: "sahanda-yumurta", nameTr: "Sahanda Yumurta Tabağı", nameEn: "Fried Eggs Plate", descriptionTr: "Tereyağında pişmiş yumurta, közlenmiş sebze eşliğinde.", descriptionEn: "Butter-fried eggs with roasted vegetables.", priceMinor: 17000 },
          { slug: "granola-kase", nameTr: "Granola Kase", nameEn: "Granola Bowl", descriptionTr: "Ev yapımı granola, yoğurt ve mevsim meyveleri.", descriptionEn: "House-made granola, yogurt, and seasonal fruit.", priceMinor: 16000 },
        ],
      },
    ],
  },
  {
    key: "restaurant",
    categories: [
      {
        nameTr: "Başlangıçlar",
        nameEn: "Starters",
        products: [
          { slug: "karides-guvec", nameTr: "Karides Güveç", nameEn: "Shrimp Casserole", descriptionTr: "Domates sos ve kaşar peyniriyle fırınlanmış karides.", descriptionEn: "Shrimp baked in tomato sauce with melted cheese.", priceMinor: 34000 },
          { slug: "burrata-salatasi", nameTr: "Burrata Salatası", nameEn: "Burrata Salad", descriptionTr: "Kremamsı burrata, cherry domates ve fesleğen yağı.", descriptionEn: "Creamy burrata, cherry tomatoes, and basil oil.", priceMinor: 29000 },
          { slug: "consomme-corba", nameTr: "Consommé Çorba", nameEn: "Consommé Soup", descriptionTr: "Berrak ve derin lezzetli klasik et suyu çorbası.", descriptionEn: "Clear, deeply flavorful classic clarified broth.", priceMinor: 22000 },
          { slug: "tartar", nameTr: "Dana Tartar", nameEn: "Beef Tartare", descriptionTr: "El ile kıyılmış dana, kapari ve sarımsaklı ekmek eşliğinde.", descriptionEn: "Hand-cut beef with capers and garlic bread.", priceMinor: 32000 },
        ],
      },
      {
        nameTr: "Ana Yemekler",
        nameEn: "Mains",
        products: [
          { slug: "dana-bonfile", nameTr: "Dana Bonfile", nameEn: "Beef Fillet", descriptionTr: "Izgara dana bonfile, kırmızı şarap sosu ile.", descriptionEn: "Grilled beef fillet with red wine reduction.", priceMinor: 65000 },
          { slug: "confit-ordek", nameTr: "Confit Ördek", nameEn: "Duck Confit", descriptionTr: "Yavaş pişirilmiş ördek but, portakal sosuyla.", descriptionEn: "Slow-cooked duck leg with orange sauce.", priceMinor: 58000 },
          { slug: "mantarli-risotto", nameTr: "Mantarlı Risotto", nameEn: "Mushroom Risotto", descriptionTr: "Kremamsı arborio pirinci ve karışık mantar.", descriptionEn: "Creamy arborio rice with mixed mushrooms.", priceMinor: 42000 },
          { slug: "kuzu-pirzola", nameTr: "Kuzu Pirzola", nameEn: "Lamb Chops", descriptionTr: "Otlarla marine edilmiş ızgara kuzu pirzola.", descriptionEn: "Herb-marinated grilled lamb chops.", priceMinor: 68000 },
        ],
      },
      {
        nameTr: "Deniz Ürünleri",
        nameEn: "Seafood",
        products: [
          { slug: "izgara-levrek", nameTr: "Izgara Levrek", nameEn: "Grilled Sea Bass", descriptionTr: "Bütün ızgara levrek, zeytinyağı ve limon ile.", descriptionEn: "Whole grilled sea bass with olive oil and lemon.", priceMinor: 52000 },
          { slug: "somon-tataki", nameTr: "Somon Tataki", nameEn: "Salmon Tataki", descriptionTr: "Hafif mühürlenmiş somon, susamlı soya sos.", descriptionEn: "Lightly seared salmon with sesame soy dressing.", priceMinor: 46000 },
          { slug: "ahtapot-izgara", nameTr: "Ahtapot Izgara", nameEn: "Grilled Octopus", descriptionTr: "Zeytinyağlı, közlenmiş biber püresi ile.", descriptionEn: "Olive oil-grilled with roasted pepper purée.", priceMinor: 55000 },
          { slug: "deniz-taragi", nameTr: "Deniz Tarağı", nameEn: "Seared Scallops", descriptionTr: "Mühürlenmiş deniz tarağı, tereyağlı sos ile.", descriptionEn: "Pan-seared scallops with butter sauce.", priceMinor: 60000 },
        ],
      },
      {
        nameTr: "Tatlılar",
        nameEn: "Desserts",
        products: [
          { slug: "creme-brulee", nameTr: "Crème Brûlée", nameEn: "Crème Brûlée", descriptionTr: "Karamelize üstü kırılan klasik Fransız tatlısı.", descriptionEn: "Classic French dessert with a crackling caramel top.", priceMinor: 22000 },
          { slug: "cikolatali-fondan", nameTr: "Çikolatalı Fondan", nameEn: "Chocolate Fondant", descriptionTr: "Akışkan çikolata dolgulu sıcak kek.", descriptionEn: "Warm cake with a molten chocolate center.", priceMinor: 24000 },
          { slug: "panna-cotta", nameTr: "Panna Cotta", nameEn: "Panna Cotta", descriptionTr: "Vanilyalı krema ve orman meyveleri sosu.", descriptionEn: "Vanilla cream with forest berry sauce.", priceMinor: 20000 },
          { slug: "meyveli-pavlova", nameTr: "Meyveli Pavlova", nameEn: "Fruit Pavlova", descriptionTr: "Çıtır beze, krema ve mevsim meyveleri.", descriptionEn: "Crisp meringue with cream and seasonal fruit.", priceMinor: 23000 },
        ],
      },
    ],
  },
  {
    key: "patisserie",
    categories: [
      {
        nameTr: "Ekmekler",
        nameEn: "Breads",
        products: [
          { slug: "eksi-maya-ekmek", nameTr: "Ekşi Maya Ekmek", nameEn: "Sourdough Bread", descriptionTr: "24 saat mayalanmış, çıtır kabuklu ekşi maya.", descriptionEn: "24-hour fermented sourdough with a crisp crust.", priceMinor: 9000 },
          { slug: "cavdar-ekmegi", nameTr: "Çavdar Ekmeği", nameEn: "Rye Bread", descriptionTr: "Yoğun dokulu, tam tahıllı çavdar ekmeği.", descriptionEn: "Dense-textured whole grain rye bread.", priceMinor: 8500 },
          { slug: "baget", nameTr: "Baget", nameEn: "Baguette", descriptionTr: "Geleneksel Fransız usulü çıtır baget.", descriptionEn: "Traditional French-style crisp baguette.", priceMinor: 7000 },
          { slug: "zeytinli-ekmek", nameTr: "Zeytinli Ekmek", nameEn: "Olive Bread", descriptionTr: "Siyah zeytin parçacıklı, yumuşak iç dokulu ekmek.", descriptionEn: "Soft-crumbed bread studded with black olives.", priceMinor: 9500 },
        ],
      },
      {
        nameTr: "Kurabiyeler",
        nameEn: "Cookies",
        products: [
          { slug: "antep-fistikli-kurabiye", nameTr: "Antep Fıstıklı Kurabiye", nameEn: "Pistachio Cookie", descriptionTr: "Bol Antep fıstıklı, tereyağlı kurabiye.", descriptionEn: "Buttery cookie loaded with pistachios.", priceMinor: 6500 },
          { slug: "cikolata-parcacikli-kurabiye", nameTr: "Çikolata Parçacıklı Kurabiye", nameEn: "Chocolate Chip Cookie", descriptionTr: "Bol çikolata parçacıklı, dışı çıtır içi yumuşak.", descriptionEn: "Loaded with chocolate chips, crisp outside, soft inside.", priceMinor: 6000 },
          { slug: "un-kurabiyesi", nameTr: "Un Kurabiyesi", nameEn: "Shortbread Cookie", descriptionTr: "Ağızda dağılan, sade tereyağlı klasik.", descriptionEn: "Melt-in-the-mouth classic butter shortbread.", priceMinor: 5500 },
          { slug: "badem-kurabiyesi", nameTr: "Badem Kurabiyesi", nameEn: "Almond Cookie", descriptionTr: "Öğütülmüş badem ile hazırlanmış hafif kurabiye.", descriptionEn: "Light cookie made with ground almonds.", priceMinor: 6500 },
        ],
      },
      {
        nameTr: "Pastalar",
        nameEn: "Cakes",
        products: [
          { slug: "red-velvet-pasta", nameTr: "Red Velvet Pasta", nameEn: "Red Velvet Cake", descriptionTr: "Kadife dokulu kırmızı pandispanya, cream cheese kremalı.", descriptionEn: "Velvety red sponge with cream cheese frosting.", priceMinor: 17000 },
          { slug: "limon-pasta", nameTr: "Limon Pasta", nameEn: "Lemon Cake", descriptionTr: "Ferahlatıcı limon kremalı, hafif pandispanya.", descriptionEn: "Light sponge with a refreshing lemon cream.", priceMinor: 16000 },
          { slug: "frambuazli-cheesecake", nameTr: "Frambuazlı Cheesecake Pasta", nameEn: "Raspberry Cheesecake", descriptionTr: "Kremamsı cheesecake, taze frambuaz sosuyla.", descriptionEn: "Creamy cheesecake with fresh raspberry sauce.", priceMinor: 18500 },
          { slug: "cikolatali-ganajli-pasta", nameTr: "Çikolatalı Ganajlı Pasta", nameEn: "Chocolate Ganache Cake", descriptionTr: "Yoğun çikolata pandispanya, parlak ganaj kaplama.", descriptionEn: "Rich chocolate sponge with glossy ganache coating.", priceMinor: 18000 },
        ],
      },
      {
        nameTr: "Böreksi Ürünler",
        nameEn: "Savory Pastries",
        products: [
          { slug: "peynirli-poaca", nameTr: "Peynirli Poğaça", nameEn: "Cheese Pastry", descriptionTr: "Tereyağlı hamur içinde bol beyaz peynir.", descriptionEn: "Buttery dough filled with white cheese.", priceMinor: 6000 },
          { slug: "ispanakli-borek", nameTr: "Ispanaklı Börek", nameEn: "Spinach Pastry", descriptionTr: "Çıtır yufka arasında ıspanak ve peynir harcı.", descriptionEn: "Crisp phyllo layers with a spinach-cheese filling.", priceMinor: 7500 },
          { slug: "kruvasan", nameTr: "Kruvasan", nameEn: "Croissant", descriptionTr: "Katmer katmer, tereyağlı klasik Fransız kruvasanı.", descriptionEn: "Flaky, buttery classic French croissant.", priceMinor: 7000 },
          { slug: "simit", nameTr: "Simit", nameEn: "Sesame Ring Bread", descriptionTr: "Pekmezli susamla kaplanmış geleneksel simit.", descriptionEn: "Traditional ring bread coated in molasses and sesame.", priceMinor: 4000 },
        ],
      },
    ],
  },
];

export function menuTemplateImagePath(templateKey: MenuTemplateKey, slug: string): string {
  return `_templates/${templateKey}/${slug}.webp`;
}
