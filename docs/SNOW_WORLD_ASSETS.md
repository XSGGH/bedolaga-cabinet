# Зимняя станция XSG — графические ресурсы V2

Созданы встроенным image_gen по skill imagegen, с фирменным белым котом XSG в фиолетовом шлеме как визуальным референсом. CLI и сторонние иллюстрации не использовались. Публикуются два согласованных ассета; окна, огни, звёзды, сияние и интерактивность реализованы кодом.

## Ресурсы

- `station-v2.webp` — единый фон 1536 × 1024, 1 840 810 байт.
- `station-sprites-v2.webp` — прозрачный атлас 1254 × 1254, 1 762 722 байта.

WebP экспортирован без потерь (`lossless=True`, `exact=True`); декодированные RGBA-пиксели сверены с исходными PNG. Альфа атласа сохранена. Дубликаты PNG не входят в поставку.

## Финальное задание на фон

Create an original coherent winter space station panorama for XSG VPN, landscape 3:2. Graphite Violet palette, polished illustrated game environment, violet night sky, snow, warm practical lamps. Modern futuristic datacenter on the left, with convincing windows, facade and entrance; a broad EMPTY central snowy plaza reserved for a large Christmas tree that will be a separate layer; the cat's futuristic gift workshop on the right; outer-space orbit above. Fixed slightly elevated perspective and connected snowy paths. Leave readable space for later props. No Christmas tree, no crowds and no foreground gifts baked into the background. No UI, buttons, frames, captions or progress bars. Only an unobtrusive XSG mark on the datacenter. Match the friendly white XSG cat's purple helmet aesthetic, while keeping the background usable without the character. No medieval castle, no generic stock Christmas city, no protruding ears through helmets. Consistent violet lighting and soft snow, detailed but clear at mobile size.

## Финальное задание на атлас

Create a coherent game prop atlas matching the winter XSG space station, genuine transparent background. A precise 4 by 4 equal-cell grid, consistent slightly elevated perspective, each object fully inside its own cell with transparent padding, no labels, no borders, no opaque/checkerboard backdrop. Original friendly white XSG cat with round purple space helmet, no ears sticking outside the helmet, same identity as the supplied brand reference. Warm golden practical lights and Graphite Violet materials, snow on bases. All objects stand on coherent small snowy bases and match the panorama's lighting. Row-major cells: 1 large winter lamp, 2 large unadorned snowy Christmas tree, 3 wrapped gifts, 4 golden light arch; 5 decoration crates, 6 cat carrying gift, 7 two cat helpers, 8 festive sleigh; 9 large ice sculpture, 10 photo booth, 11 decorated satellite, 12 three visiting cats; 13 bauble, 14 snow crystal, 15 glowing golden star, 16 seated main XSG cat. Keep silhouettes clean and recognizable at small sizes; no unwanted text or extra objects crossing cells.

## Карта атласа

Индексы CSS с нуля: 0 фонарь; 1 ёлка; 2 подарки; 3 арка; 4 ящики; 5 кот с подарком; 6 помощники; 7 сани; 8 ледяная скульптура; 9 фотозона; 10 спутник; 11 гости; 12 игрушка; 13 кристалл; 14 звезда; 15 главный кот.

Фон и атлас загружаются страницей события; 25 отдельных тяжёлых картинок не используются. Все места фиксированы. Пользовательские предметы размещаются вдоль передней дорожки, вне лиц котов и здания.
