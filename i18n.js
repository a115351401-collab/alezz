/* ═══════════════════════════════════════════════════════════
   i18n.js — trilingual engine for العز العالمي
   Languages: ar (العربية, RTL) · en (English) · ko (한국어)
   Canonical authoring base is English; the live DOM is Arabic,
   so translation always goes  ar(source) → en / ko, and 'ar'
   simply restores the original text nodes.

   Public API (window.I18N):
     I18N.lang            → current language code
     I18N.set(code)       → switch language (persists + re-applies)
     I18N.t(key, vars)    → translate a dynamic string (KEYS table)
     I18N.apply()         → re-translate the DOM (after injecting nodes)
     I18N.onChange(fn)    → subscribe to language changes
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGS = { ar: 'العربية', en: 'English', ko: '한국어' };
  var SHORT = { ar: 'ع', en: 'EN', ko: '한' };

  /* ── KEYS: stable-key table for dynamic / JS-generated strings ── */
  var KEYS = {
    lc_new:        { ar: 'وصل حديثاً', en: 'Just arrived', ko: '방금 입고' },
    lc_ask:        { ar: 'اسأل عن هذه السيارة', en: 'Ask about this car', ko: '이 차량 문의' },
    lc_no_results: { ar: 'لا توجد نتائج لهذا البحث حالياً', en: 'No results for this search right now', ko: '현재 검색 결과가 없습니다' },
    lc_load_fail:  { ar: 'تعذّر تحميل السيارات مؤقتاً —', en: "Couldn't load cars right now —", ko: '차량을 불러오지 못했습니다 —' },
    lc_retry:      { ar: 'أعد المحاولة', en: 'Retry', ko: '다시 시도' },
    lc_browse_n:   { ar: 'تصفح {n} سيارة بأسعار وصور حقيقية — محدّثة لحظياً من كوريا',
                     en: 'Browse {n} cars with real prices and photos — updated live from Korea',
                     ko: '{n}대의 차량을 실제 가격과 사진으로 — 한국에서 실시간 업데이트' },
    unit_km:       { ar: 'كم', en: 'km', ko: 'km' },
    src_korea:     { ar: 'كوريا', en: 'Korea', ko: '한국' },
    fuel_gasoline: { ar: 'بنزين', en: 'Gasoline', ko: '가솔린' },
    fuel_diesel:   { ar: 'ديزل', en: 'Diesel', ko: '디젤' },
    fuel_hybrid:   { ar: 'هايبرد', en: 'Hybrid', ko: '하이브리드' },
    fuel_electric: { ar: 'كهربائية', en: 'Electric', ko: '전기' },
    fuel_lpg:      { ar: 'غاز', en: 'LPG', ko: 'LPG' },
    trans_auto:    { ar: 'أوتوماتيك', en: 'Automatic', ko: '자동' },
    trans_manual:  { ar: 'عادي', en: 'Manual', ko: '수동' },
    wa_greeting:   { ar: 'مرحباً، أهتم بهذه السيارة المعروضة في موقعكم:', en: "Hello, I'm interested in this car listed on your site:", ko: '안녕하세요, 사이트에 등록된 이 차량에 관심이 있습니다:' },
    wa_year:       { ar: 'الموديل', en: 'Year', ko: '연식' },
    wa_price:      { ar: 'السعر', en: 'Price', ko: '가격' },
    wa_ref:        { ar: 'رقم المرجع', en: 'Ref. No.', ko: '참조 번호' },
    calc_saving:   { ar: 'توفير', en: 'saved', ko: '절감' },

    // cars.html (search page)
    cars_deal:     { ar: '🔥 صفقة', en: '🔥 Deal', ko: '🔥 특가' },
    cars_none:     { ar: 'لا توجد سيارات مطابقة لبحثك — جرّب تعديل الفلاتر', en: 'No cars match your search — try adjusting the filters', ko: '검색과 일치하는 차량이 없습니다 — 필터를 조정해 보세요' },
    cars_count:    { ar: 'وجدنا {n} سيارة مطابقة', en: 'Found {n} matching cars', ko: '{n}대의 일치하는 차량을 찾았습니다' },
    cars_fail:     { ar: 'تعذّر التحميل مؤقتاً —', en: 'Loading failed —', ko: '불러오기 실패 —' },
    cars_no_brand: { ar: 'لا نتائج', en: 'No results', ko: '결과 없음' },
    price_range:   { ar: 'نطاق السعر', en: 'Price range', ko: '가격 범위' },
    ph_from:       { ar: 'من', en: 'From', ko: '최소' },
    ph_to:         { ar: 'إلى', en: 'To', ko: '최대' },
    ph_brand:      { ar: 'ابحث: Genesis، Kia، BMW…', en: 'Search: Genesis, Kia, BMW…', ko: '검색: Genesis, Kia, BMW…' },
    ph_model:      { ar: 'مثال: G80، Sorento، Carnival', en: 'e.g. G80, Sorento, Carnival', ko: '예: G80, Sorento, Carnival' },
    ph_ref:        { ar: 'أدخل الرقم المرجعي', en: 'Enter reference number', ko: '참조 번호 입력' },

    // car.html (detail page)
    car_back:      { ar: '← رجوع', en: '← Back', ko: '← 뒤로' },
    car_loading:   { ar: 'جارٍ تحميل بيانات السيارة…', en: 'Loading vehicle data…', ko: '차량 정보를 불러오는 중…' },
    car_not_found: { ar: 'تعذّر العثور على السيارة', en: 'Vehicle not found', ko: '차량을 찾을 수 없습니다' },
    car_not_found_d:{ ar: 'ربما بيعت السيارة أو انتهى عرضها. تصفح سيارات أخرى متاحة.', en: 'The car may be sold or no longer listed. Browse other available cars.', ko: '차량이 판매되었거나 더 이상 등록되어 있지 않을 수 있습니다. 다른 차량을 둘러보세요.' },
    car_browse:    { ar: 'تصفح السيارات المتاحة', en: 'Browse available cars', ko: '구매 가능 차량 보기' },
    car_disclaimer:{ ar: '* السعر لا يشمل الشحن والجمارك', en: '* Price excludes shipping and customs', ko: '* 가격은 배송 및 통관 비용 제외' },
    car_ask_wa:    { ar: 'اطلب هذه السيارة عبر واتساب', en: 'Request this car via WhatsApp', ko: 'WhatsApp으로 이 차량 문의' },
    car_specs:     { ar: 'المواصفات', en: 'Specifications', ko: '사양' },
    car_report:    { ar: 'تقرير الحالة', en: 'Condition Report', ko: '상태 보고서' },
    car_market:    { ar: 'تحليل سعر السوق', en: 'Market Price Analysis', ko: '시세 분석' },
    car_desc:      { ar: 'الوصف', en: 'Description', ko: '설명' },
    car_features:  { ar: 'المزايا والتجهيزات', en: 'Features & Equipment', ko: '옵션 및 사양' },
    sp_year:       { ar: 'سنة الصنع', en: 'Year', ko: '연식' },
    sp_mileage:    { ar: 'الكيلومترات', en: 'Mileage', ko: '주행거리' },
    sp_fuel:       { ar: 'الوقود', en: 'Fuel', ko: '연료' },
    sp_trans:      { ar: 'ناقل الحركة', en: 'Transmission', ko: '변속기' },
    sp_body:       { ar: 'نوع المركبة', en: 'Body type', ko: '차종' },
    sp_color:      { ar: 'اللون', en: 'Color', ko: '색상' },
    sp_engine:     { ar: 'سعة المحرك', en: 'Engine', ko: '배기량' },
    sp_drive:      { ar: 'نظام الدفع', en: 'Drivetrain', ko: '구동 방식' },
    sp_seats:      { ar: 'عدد المقاعد', en: 'Seats', ko: '좌석 수' },
    sp_owners:     { ar: 'عدد المُلّاك', en: 'Owners', ko: '소유자 수' },
    sp_seller:     { ar: 'نوع البائع', en: 'Seller type', ko: '판매자 유형' },
    sp_region:     { ar: 'المنطقة', en: 'Region', ko: '지역' },
    rp_accident:   { ar: 'حوادث سابقة', en: 'Prior accidents', ko: '사고 이력' },
    rp_repair:     { ar: 'إصلاحات بسيطة', en: 'Minor repairs', ko: '단순 수리' },
    rp_recall:     { ar: 'استدعاء مصنعي', en: 'Manufacturer recall', ko: '제조사 리콜' },
    rp_recall_ok:  { ar: 'تم تنفيذ الاستدعاء', en: 'Recall fulfilled', ko: '리콜 완료' },
    rp_inspect:    { ar: 'اجتاز الفحص الرسمي', en: 'Passed official inspection', ko: '공식 검사 통과' },
    rp_warranty:   { ar: 'الضمان', en: 'Warranty', ko: '보증' },
    rp_vin:        { ar: 'رقم الهيكل (VIN)', en: 'VIN', ko: '차대번호 (VIN)' },
    val_yes:       { ar: 'نعم', en: 'Yes', ko: '예' },
    val_no:        { ar: 'لا', en: 'No', ko: '아니오' },
    val_none:      { ar: 'لا يوجد', en: 'None', ko: '없음' },
    mk_great:      { ar: 'أقل من سعر السوق', en: 'Below market', ko: '시세 이하' },
    mk_good:       { ar: 'سعر جيد', en: 'Good price', ko: '좋은 가격' },
    mk_fair:       { ar: 'سعر عادل', en: 'Fair price', ko: '적정 가격' },
    mk_high:       { ar: 'أعلى من سعر السوق', en: 'Above market', ko: '시세보다 높음' },
    mk_status:     { ar: 'تقييم السعر', en: 'Price rating', ko: '가격 평가' },
    mk_estimate:   { ar: 'السعر التقديري العادل', en: 'Estimated fair price', ko: '예상 적정가' },
    mk_diff:       { ar: 'الفرق عن السوق', en: 'Difference vs. market', ko: '시세 대비 차이' },
    mk_compared:   { ar: 'سيارات مشابهة قورنت', en: 'Similar cars compared', ko: '비교된 유사 차량' },
    mk_none:       { ar: 'لا يتوفر تحليل سعري لهذه السيارة بعد', en: 'No price analysis available for this car yet', ko: '아직 이 차량의 가격 분석이 없습니다' },
    mk_lowest:     { ar: 'الأرخص', en: 'Lowest', ko: '최저' },
    mk_median:     { ar: 'الوسيط', en: 'Median', ko: '중간값' },
    mk_highest:    { ar: 'الأغلى', en: 'Highest', ko: '최고' },
    cars_new_badge:{ ar: 'جديد', en: 'New', ko: '신차' },
    badge_noacc:   { ar: 'بدون حوادث', en: 'No accidents', ko: '무사고' },
    unit_cc:       { ar: 'سي سي', en: 'cc', ko: 'cc' },
    unit_seats:    { ar: 'مقاعد', en: 'seats', ko: '석' }
  };

  /* ── TEXT_MAP: static visible text, keyed by normalized Arabic ──
     (Engine restores Arabic for lang='ar', so only en/ko needed.)  */
  var TEXT_MAP = {
    // Brand / nav
    'معرض العز العالمي': { en: 'AL-EZZ International', ko: '알에즈 인터내셔널' },
    'استيراد سيارات كورية فاخرة': { en: 'Premium Korean Car Imports', ko: '프리미엄 한국 자동차 수입' },
    'مميزاتنا': { en: 'Features', ko: '장점' },
    'المزادات': { en: 'Auctions', ko: '경매' },
    'قصص النجاح': { en: 'Success Stories', ko: '성공 사례' },
    'الأسئلة الشائعة': { en: 'FAQ', ko: '자주 묻는 질문' },
    'السيارات المتاحة': { en: 'Available Cars', ko: '구매 가능 차량' },
    'تواصل معنا': { en: 'Contact Us', ko: '문의하기' },
    'تواصل معنا الآن': { en: 'Contact Us Now', ko: '지금 문의하기' },
    'القائمة': { en: 'Menu', ko: '메뉴' },
    'تواصل عبر واتساب': { en: 'Contact via WhatsApp', ko: 'WhatsApp으로 문의' },

    // Hero (s1)
    'منذ 2019 — أكثر من 3000 سيارة': { en: 'Since 2019 — 3000+ cars', ko: '2019년부터 — 3,000대 이상' },
    'استورد سيارتك الكورية الفاخرة': { en: 'Import your premium Korean car', ko: '프리미엄 한국 차량을 수입하세요' },
    'مع معرض العز العالمي': { en: 'with AL-EZZ International', ko: '알에즈 인터내셔널과 함께' },
    'خبرة منذ 2019، استوردنا أكثر من': { en: 'With experience since 2019, we have successfully imported over', ko: '2019년부터의 경험으로 다음 이상을 성공적으로 수입했습니다' },
    'بنجاح. نرافقك في رحلة ميدانية من كوريا إلى الرياض.': { en: 'cars. We accompany you on a field journey from Korea to Riyadh.', ko: '대. 한국에서 리야드까지 현장 여정을 함께합니다.' },
    'تواصل معنا للبحث عن سيارتك': { en: 'Contact us to find your car', ko: '차량 찾기 문의하기' },
    'اكتشف رحلة الاستيراد الميدانية': { en: 'Discover the field import journey', ko: '현장 수입 여정 보기' },
    'ضمان الجودة': { en: 'Quality Guarantee', ko: '품질 보증' },
    'فحص فني شامل': { en: 'Full Technical Inspection', ko: '정밀 기술 점검' },
    'رضا 100%': { en: '100% Satisfaction', ko: '100% 만족' },
    'سيارة مُستوردة': { en: 'Imported Cars', ko: '수입 차량' },
    'تأسيس الشركة': { en: 'Company Founded', ko: '회사 설립' },
    'مرِّر للأسفل': { en: 'Scroll down', ko: '아래로 스크롤' },

    // Field journey (s2)
    'الرحلة الميدانية إلى كوريا': { en: 'The Field Journey to Korea', ko: '한국 현장 여정' },
    'نرافقك خطوةً بخطوة': { en: 'We accompany you step by step', ko: '단계별로 함께합니다' },
    'من إنتشون إلى الرياض': { en: 'From Incheon to Riyadh', ko: '인천에서 리야드까지' },
    'استقبال في مطار إنتشون وإقامة فندقية': { en: 'Airport pickup at Incheon & hotel stay', ko: '인천공항 영접 및 호텔 숙박' },
    'جولة على المزادات وفحص السيارات': { en: 'Auction tours & vehicle inspection', ko: '경매장 투어 및 차량 점검' },
    'تفاوض مباشر وإتمام صفقة الشراء': { en: 'Direct negotiation & closing the deal', ko: '직접 협상 및 구매 완료' },
    'شحن وتخليص جمركي حتى الرياض': { en: 'Shipping & customs clearance to Riyadh', ko: '리야드까지 배송 및 통관' },
    'احجز رحلتك الميدانية الآن': { en: 'Book your field trip now', ko: '지금 현장 방문 예약' },
    'تابع التمرير': { en: 'Keep scrolling', ko: '계속 스크롤' },
    '١': { en: '1', ko: '1' }, '٢': { en: '2', ko: '2' }, '٣': { en: '3', ko: '3' }, '٤': { en: '4', ko: '4' },

    // Live cars
    'مباشر من كوريا الآن': { en: 'Live from Korea Now', ko: '지금 한국에서 실시간' },
    'سيارات متاحة': { en: 'Cars available', ko: '구매 가능한 차량' },
    'الآن في كوريا': { en: 'now in Korea', ko: '지금 한국에' },
    'أسعار وصور حقيقية محدّثة لحظياً من المزادات والمعارض الكورية': { en: 'Real prices & photos, updated live from Korean auctions and showrooms', ko: '한국 경매장과 전시장에서 실시간 업데이트되는 실제 가격과 사진' },
    'الكل': { en: 'All', ko: '전체' },
    'جينيسيس': { en: 'Genesis', ko: '제네시스' },
    'هيونداي': { en: 'Hyundai', ko: '현대' },
    'كيا': { en: 'Kia', ko: '기아' },
    'مرسيدس': { en: 'Mercedes', ko: '메르세데스' },
    'تصفح جميع السيارات': { en: 'Browse all cars', ko: '모든 차량 보기' },
    'تصفح 3,409+ سيارة بأسعار وصور حقيقية — محدّثة لحظياً من كوريا': { en: 'Browse 3,409+ cars with real prices and photos — updated live from Korea', ko: '실제 가격과 사진이 있는 3,409대 이상의 차량 — 한국에서 실시간 업데이트' },

    // Full-screen visual (s3)
    'الفخامة بلا حدود': { en: 'Luxury Without Limits', ko: '한계 없는 럭셔리' },
    'استوردنا أكثر من': { en: 'We have imported over', ko: '지금까지 수입한 차량' },
    '3000 سيارة فاخرة': { en: '3000 luxury cars', ko: '3,000대의 럭셔리 차량' },
    'تجربة مرئية حية من أرض المزادات الكورية — كل سيارة رحلة وقصة': { en: "A live visual experience from Korea's auction grounds — every car a journey and a story", ko: '한국 경매 현장의 생생한 영상 경험 — 모든 차량은 하나의 여정이자 이야기' },
    'ابدأ رحلتك الآن': { en: 'Start your journey now', ko: '지금 여정을 시작하세요' },
    'نسبة رضا العملاء': { en: 'Customer Satisfaction', ko: '고객 만족도' },
    'سنة التأسيس': { en: 'Year Founded', ko: '설립 연도' },
    'سنوات خبرة': { en: 'Years of Experience', ko: '경력 연수' },
    'معرض (رياض + كوريا)': { en: 'Showrooms (Riyadh + Korea)', ko: '전시장 (리야드 + 한국)' },

    // Features
    'لماذا معرض العز العالمي؟': { en: 'Why AL-EZZ International?', ko: '왜 알에즈 인터내셔널인가?' },
    'مزاياكم التنافسية': { en: 'Your Competitive Advantages', ko: '당신의 경쟁 우위' },
    'نقدم تجربة استيراد متكاملة ومضمونة من أول اتصال حتى استلام مفاتيح سيارتك': { en: 'We offer a complete, guaranteed import experience — from the first call to handing you the keys', ko: '첫 연락부터 차 키를 건네받는 순간까지 완벽하고 보장된 수입 경험을 제공합니다' },
    'خبرة منذ 2019': { en: 'Experience since 2019', ko: '2019년부터의 경험' },
    'تم استيرادها بنجاح. تاريخ حافل يتحدث عن نفسه.': { en: 'successfully imported. A track record that speaks for itself.', ko: '대를 성공적으로 수입했습니다. 실적이 스스로 말해줍니다.' },
    'خدمة مرافقة ميدانية': { en: 'Field Accompaniment Service', ko: '현장 동행 서비스' },
    'استقبال، إقامة، فحص دقيق، وتفاوض مباشر في كوريا. نحن معك خطوة بخطوة.': { en: 'Pickup, accommodation, precise inspection, and direct negotiation in Korea. We are with you every step.', ko: '영접, 숙박, 정밀 점검, 그리고 한국에서의 직접 협상. 매 단계 함께합니다.' },
    'فحص فني دقيق': { en: 'Precise Technical Inspection', ko: '정밀 기술 점검' },
    'تواجد محلي ودولي': { en: 'Local & International Presence', ko: '국내외 네트워크' },
    'وفي': { en: 'and in', ko: '그리고' },

    // Auctions
    'فرص حصرية': { en: 'Exclusive Opportunities', ko: '독점 기회' },
    'مزادات كوريا': { en: 'Korea Auctions', ko: '한국 경매' },
    'اليوم': { en: 'Today', ko: '오늘' },
    'أسعار المزادات محدَّثة — تواصل معنا فوراً للتزايد قبل فوات الأوان': { en: 'Auction prices updated — contact us now to bid before it is too late', ko: '경매 가격 업데이트 — 늦기 전에 지금 입찰 문의하세요' },
    'جينيسس 2025': { en: 'Genesis 2025', ko: '제네시스 2025' },
    'هونداي ازيرا 2025': { en: 'Hyundai Azera 2025', ko: '현대 아제라 2025' },
    'كيا كي 8': { en: 'Kia K8', ko: '기아 K8' },
    'متاح الآن': { en: 'Available Now', ko: '지금 구매 가능' },
    'مزاد حار': { en: 'Hot Auction', ko: '인기 경매' },
    'ينتهي قريباً': { en: 'Ending Soon', ko: '곧 종료' },
    'السعر الحالي في المزاد': { en: 'Current auction price', ko: '현재 경매가' },
    'سعر الشركة التقديري': { en: 'Estimated dealer price', ko: '예상 딜러 가격' },
    'توفيرك المتوقع:': { en: 'Your expected savings:', ko: '예상 절감액:' },
    'زايد الآن': { en: 'Bid Now', ko: '지금 입찰' },
    '2025 — 1,200 كم': { en: '2025 — 1,200 km', ko: '2025 — 1,200 km' },
    '2025 — 3,200 كم': { en: '2025 — 3,200 km', ko: '2025 — 3,200 km' },
    '2025 — 4,500 كم': { en: '2025 — 4,500 km', ko: '2025 — 4,500 km' },

    // Calculator
    'حساب توفير الاستيراد': { en: 'Import Savings Calculator', ko: '수입 절감 계산기' },
    'محاكي التوفير التفاعلي': { en: 'Interactive Savings Simulator', ko: '인터랙티브 절감 시뮬레이터' },
    'قارن تكلفة الاستيراد شاملة الشحن والجمارك مع أسعار السوق المحلي مباشرة': { en: 'Compare the full import cost (shipping + customs) against local market prices instantly', ko: '배송과 통관을 포함한 전체 수입 비용을 국내 시장 가격과 즉시 비교하세요' },
    'قيمة المركبة': { en: 'Vehicle value', ko: '차량 가치' },
    'تكلفة الشحن البحري': { en: 'Sea freight cost', ko: '해상 운송비' },
    'الجمارك والرسوم': { en: 'Customs & fees', ko: '관세 및 수수료' },
    'قيمة الفائدة': { en: 'Service value', ko: '서비스 가치' },
    'ثابت': { en: 'Fixed', ko: '고정' },
    '٢٠٪': { en: '20%', ko: '20%' },
    'التكلفة التقريبية للاستيراد': { en: 'Approx. import cost', ko: '대략적인 수입 비용' },
    'نتائج الحساب المباشرة': { en: 'Live calculation results', ko: '실시간 계산 결과' },
    'التكلفة الإجمالية معك': { en: 'Total cost with us', ko: '당사 이용 시 총 비용' },
    '* تشمل سعر المزاد، الشحن والرسوم': { en: '* Includes auction price, shipping and fees', ko: '* 경매가, 배송비, 수수료 포함' },
    'السوق المحلي': { en: 'Local market', ko: '국내 시장' },
    'وفرت مع العز': { en: 'You saved with AL-EZZ', ko: '알에즈로 절감' },
    'نسبة التوفير التقديرية': { en: 'Estimated savings rate', ko: '예상 절감률' },
    'ابدأ رحلة الاستيراد والتوفير': { en: 'Start importing and saving', ko: '수입과 절감을 시작하세요' },

    // Stats band
    'سنوات خبرة': { en: 'Years of Experience', ko: '경력 연수' },

    // Success stories
    'عملاؤنا يتحدثون': { en: 'Our Clients Speak', ko: '고객의 목소리' },
    'قصص نجاح من معرض العز العالمي': { en: 'Success stories from AL-EZZ International', ko: '알에즈 인터내셔널의 성공 사례' },
    'خالد العتيبي — الرياض': { en: 'Khalid Al-Otaibi — Riyadh', ko: '칼리드 알오타이비 — 리야드' },
    'محمد الشمري — جدة': { en: 'Mohammed Al-Shammari — Jeddah', ko: '모하메드 알샴마리 — 제다' },
    'عبدالله الدوسري — الدمام': { en: 'Abdullah Al-Dosari — Dammam', ko: '압둘라 알도사리 — 담맘' },
    '"استوردت جينيسس 2025 موفراً أكثر من 22,000 ريال مقارنة بالوكيل. الفريق رافقني في كوريا وأشرف على كل شيء. تجربة لا تُنسى!"': { en: '"I imported a Genesis 2025, saving over 22,000 SAR versus the dealer. The team accompanied me in Korea and oversaw everything. Unforgettable!"', ko: '"제네시스 2025를 수입해 딜러 대비 22,000 SAR 이상 절감했습니다. 팀이 한국에서 동행하며 모든 것을 챙겨주었어요. 잊지 못할 경험!"' },
    '"ما توقعت الخدمة تكون بهذا المستوى. الشفافية الكاملة في الأسعار والفحص الدقيق أعطاني ثقة كبيرة. نصحت كل أصدقائي بهم."': { en: '"I never expected this level of service. Full price transparency and precise inspection gave me great confidence. I recommended them to all my friends."', ko: '"이 정도의 서비스는 기대하지 못했어요. 완전한 가격 투명성과 정밀 점검이 큰 신뢰를 주었습니다. 친구들에게 모두 추천했어요."' },
    '"اشتريت كيا كي 8 وتم التسليم خلال 45 يوماً بالضبط. السيارة وصلت بحالة ممتازة تماماً كما وُصفت. أفضل قرار اتخذته."': { en: '"I bought a Kia K8 and it was delivered in exactly 45 days. The car arrived in excellent condition, exactly as described. Best decision I made."', ko: '"기아 K8을 구매했고 정확히 45일 만에 배송되었습니다. 차량은 설명 그대로 훌륭한 상태로 도착했어요. 최고의 선택이었습니다."' },

    // Tracking map
    'خريطة التتبع التفاعلية ثلاثية الأبعاد': { en: '3D Interactive Tracking Map', ko: '3D 인터랙티브 추적 지도' },
    'مسار الاستيراد: الرياض': { en: 'Import route: Riyadh', ko: '수입 경로: 리야드' },
    'المرحلة الحالية': { en: 'Current stage', ko: '현재 단계' },

    // FAQ
    'كل ما تريد معرفته': { en: 'Everything You Want to Know', ko: '알고 싶은 모든 것' },
    'كيف تضمنون مطابقة المواصفات المطلوبة؟': { en: 'How do you guarantee the car matches the required specs?', ko: '요청한 사양과 일치함을 어떻게 보장하나요?' },
    'نعتمد على قائمة تفصيلية دقيقة تشمل الموديل، السنة، اللون، المحرك، والمواصفات التقنية. يتم مراجعتها مع العميل قبل الذهاب للمزاد، ولا يُشترى إلا ما يطابقها 100%.': { en: 'We rely on a precise, detailed checklist covering model, year, color, engine, and technical specs. It is reviewed with the client before the auction, and we only buy what matches it 100%.', ko: '모델, 연식, 색상, 엔진, 기술 사양을 포함한 정밀한 체크리스트를 사용합니다. 경매 전 고객과 검토하며, 100% 일치하는 차량만 구매합니다.' },
    'ما هي آلية الفحص الفني قبل الشراء؟': { en: 'What is the technical inspection process before purchase?', ko: '구매 전 기술 점검 절차는 어떻게 되나요?' },
    'نستخدم أجهزة فحص معتمدة تكشف الحوادث السابقة، التصوير الكامل، وتقرير المصنع. يُرسل للعميل تقرير PDF شامل مع صور 360° قبل المصادقة على الشراء.': { en: 'We use certified inspection equipment that detects prior accidents, full photography, and the factory report. A comprehensive PDF report with 360° photos is sent to the client before approving the purchase.', ko: '이전 사고를 감지하는 인증 점검 장비, 전체 촬영, 제조사 보고서를 사용합니다. 구매 승인 전 360° 사진이 포함된 종합 PDF 보고서를 고객에게 보냅니다.' },
    'كم تستغرق مدة الشحن من كوريا إلى الرياض؟': { en: 'How long does shipping take from Korea to Riyadh?', ko: '한국에서 리야드까지 배송은 얼마나 걸리나요?' },
    'ما هي إجراءات الجمارك والتخليص؟': { en: 'What are the customs and clearance procedures?', ko: '관세 및 통관 절차는 어떻게 되나요?' },
    'هل يمكنني مرافقتكم شخصياً إلى كوريا؟': { en: 'Can I personally accompany you to Korea?', ko: '한국에 직접 동행할 수 있나요?' },

    // Footer
    'شركة متخصصة في استيراد السيارات الكورية الفاخرة منذ عام 2019. نقدم خدمة مرافقة ميدانية متكاملة من لحظة البحث عن السيارة في كوريا حتى تسليمها بيدك في الرياض.': { en: 'A company specialized in importing premium Korean cars since 2019. We provide a complete field accompaniment service — from finding the car in Korea to handing it to you in Riyadh.', ko: '2019년부터 프리미엄 한국 차량 수입을 전문으로 하는 회사입니다. 한국에서 차량을 찾는 순간부터 리야드에서 인도하기까지 완벽한 현장 동행 서비스를 제공합니다.' },
    'مواقعنا': { en: 'Our Locations', ko: '지점 안내' },
    'معرض الرياض ↗': { en: 'Riyadh Showroom ↗', ko: '리야드 전시장 ↗' },
    'واتساب مباشر': { en: 'Direct WhatsApp', ko: 'WhatsApp 바로가기' },
    'تابعونا على': { en: 'Follow us on', ko: '팔로우하기' },
    '© 2025 معرض العز العالمي لاستيراد السيارات. جميع الحقوق محفوظة.': { en: '© 2025 AL-EZZ International for Car Imports. All rights reserved.', ko: '© 2025 알에즈 인터내셔널 자동차 수입. 모든 권리 보유.' },
    'الرياض، المملكة العربية السعودية | إنتشون، كوريا الجنوبية': { en: 'Riyadh, Saudi Arabia | Incheon, South Korea', ko: '리야드, 사우디아라비아 | 인천, 대한민국' },

    // ── cars.html search page ──
    'العز العالمي': { en: 'AL-EZZ International', ko: '알에즈 인터내셔널' },
    '← الرئيسية': { en: '← Home', ko: '← 홈' },
    'مباشر من مزادات كوريا': { en: 'Live from Korean auctions', ko: '한국 경매 실시간' },
    'تصفح': { en: 'Browse', ko: '둘러보기' },
    'جميع السيارات': { en: 'all cars', ko: '모든 차량' },
    'جارٍ التحميل…': { en: 'Loading…', ko: '불러오는 중…' },
    '⚙️ الفلاتر والبحث': { en: '⚙️ Filters & Search', ko: '⚙️ 필터 및 검색' },
    'الفلاتر': { en: 'Filters', ko: '필터' },
    'الشركة المصنعة': { en: 'Make', ko: '제조사' },
    'الموديل': { en: 'Model', ko: '모델' },
    'سنة الصنع': { en: 'Year', ko: '연식' },
    'من سنة': { en: 'From year', ko: '시작 연도' },
    'إلى سنة': { en: 'To year', ko: '종료 연도' },
    'الحالة': { en: 'Condition', ko: '상태' },
    'جديد': { en: 'New', ko: '신차' },
    'مستعمل': { en: 'Used', ko: '중고' },
    'ناقل الحركة': { en: 'Transmission', ko: '변속기' },
    'أوتوماتيك': { en: 'Automatic', ko: '자동' },
    'يدوي': { en: 'Manual', ko: '수동' },
    'نوع الوقود': { en: 'Fuel type', ko: '연료' },
    'بنزين': { en: 'Gasoline', ko: '가솔린' },
    'ديزل': { en: 'Diesel', ko: '디젤' },
    'هايبرد': { en: 'Hybrid', ko: '하이브리드' },
    'بلج-إن': { en: 'Plug-in', ko: '플러그인' },
    'كهربائي': { en: 'Electric', ko: '전기' },
    'غاز': { en: 'LPG', ko: 'LPG' },
    'نوع المركبة': { en: 'Body type', ko: '차종' },
    'سيدان': { en: 'Sedan', ko: '세단' },
    'هاتشباك': { en: 'Hatchback', ko: '해치백' },
    'فان': { en: 'Van', ko: '밴' },
    'كوبيه': { en: 'Coupe', ko: '쿠페' },
    'بيك أب': { en: 'Pickup', ko: '픽업' },
    'واغن': { en: 'Wagon', ko: '왜건' },
    'كشف': { en: 'Convertible', ko: '컨버터블' },
    'نطاق السعر (ريال سعودي)': { en: 'Price range', ko: '가격 범위' },
    'الكيلومترات': { en: 'Mileage', ko: '주행거리' },
    'اللون': { en: 'Color', ko: '색상' },
    'أبيض': { en: 'White', ko: '흰색' },
    'أسود': { en: 'Black', ko: '검정' },
    'رمادي': { en: 'Gray', ko: '회색' },
    'فضي': { en: 'Silver', ko: '은색' },
    'أزرق': { en: 'Blue', ko: '파랑' },
    'أحمر': { en: 'Red', ko: '빨강' },
    'بني': { en: 'Brown', ko: '갈색' },
    'أخضر': { en: 'Green', ko: '초록' },
    'ذهبي': { en: 'Gold', ko: '금색' },
    'أصفر': { en: 'Yellow', ko: '노랑' },
    'آخر': { en: 'Other', ko: '기타' },
    'مزايا إضافية': { en: 'Extra features', ko: '추가 옵션' },
    'بدون حوادث مسجلة': { en: 'No recorded accidents', ko: '사고 이력 없음' },
    'مجتاز الفحص الرسمي': { en: 'Passed official inspection', ko: '공식 검사 통과' },
    'صفقات أقل من سعر السوق 🔥': { en: 'Below-market deals 🔥', ko: '시세 이하 매물 🔥' },
    'رقم الإعلان / مرجع': { en: 'Listing / reference no.', ko: '매물 / 참조 번호' },
    '🔍 بحث': { en: '🔍 Search', ko: '🔍 검색' },
    'إعادة تعيين': { en: 'Reset', ko: '초기화' },
    'عرض المزيد من السيارات': { en: 'Show more cars', ko: '더 많은 차량 보기' },

    // ── car.html detail page (static markup) ──
    '← جميع السيارات': { en: '← All cars', ko: '← 모든 차량' },
    'تعذّر العثور على هذه السيارة': { en: 'This car could not be found', ko: '차량을 찾을 수 없습니다' },
    'ربما بِيعت أو أُزيلت من الكتالوج': { en: 'It may be sold or removed from the catalog', ko: '판매되었거나 카탈로그에서 삭제되었을 수 있습니다' },
    'تصفح سيارات أخرى': { en: 'Browse other cars', ko: '다른 차량 보기' },
    'السعر في كوريا': { en: 'Price in Korea', ko: '한국 현지 가격' },
    '* السعر لا يشمل الشحن والجمارك — تواصل معنا لحساب التكلفة النهائية': { en: '* Price excludes shipping and customs — contact us for the final cost', ko: '* 가격은 배송 및 통관 비용 제외 — 최종 비용은 문의해 주세요' },
    'اطلب هذه السيارة الآن': { en: 'Request this car now', ko: '지금 이 차량 문의하기' },
    'الرقم المرجعي:': { en: 'Reference no.:', ko: '참조 번호:' },
    'المواصفات': { en: 'Specifications', ko: '사양' },
    'تقرير الحالة': { en: 'Condition Report', ko: '상태 보고서' },
    'تحليل السعر مقابل السوق': { en: 'Price vs. Market Analysis', ko: '시세 대비 가격 분석' },
    'وصف السيارة': { en: 'Vehicle Description', ko: '차량 설명' },
    'التجهيزات': { en: 'Equipment', ko: '사양 및 옵션' }
  };

  /* ───────────────────────── engine ───────────────────────── */
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  var state = { lang: 'ar' };
  var listeners = [];
  var originals = new WeakMap(); // text node → original Arabic value

  function detect() {
    try {
      var saved = localStorage.getItem('alezz_lang');
      if (saved && LANGS[saved]) return saved;
    } catch (e) {}
    var navs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < navs.length; i++) {
      var l = (navs[i] || '').toLowerCase();
      if (l.indexOf('ar') === 0) return 'ar';
      if (l.indexOf('ko') === 0) return 'ko';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'ar'; // Arabic fallback
  }

  function t(key, vars) {
    var entry = KEYS[key];
    var s = entry ? (entry[state.lang] || entry.ar || key) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, SVG: 1 };
  function skip(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (SKIP_TAGS[(el.tagName || '').toUpperCase()]) return true;
        if (el.hasAttribute && (el.hasAttribute('data-no-i18n') || el.hasAttribute('data-sar') || el.hasAttribute('data-usd'))) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node, batch = [];
    while ((node = walker.nextNode())) batch.push(node);
    batch.forEach(function (n) {
      var raw = n.nodeValue;
      if (!raw || !raw.trim()) return;
      if (skip(n.parentNode)) return;
      var key = norm(raw);
      if (!originals.has(n)) {
        // only track nodes we can actually translate
        if (!TEXT_MAP[key]) return;
        originals.set(n, raw);
      }
      var origKey = norm(originals.get(n));
      if (state.lang === 'ar') { n.nodeValue = originals.get(n); return; }
      var tr = TEXT_MAP[origKey];
      if (tr && tr[state.lang]) {
        // preserve leading / trailing whitespace of the original node
        var lead = (raw.match(/^\s*/) || [''])[0];
        var tail = (raw.match(/\s*$/) || [''])[0];
        n.nodeValue = lead + tr[state.lang] + tail;
      } else {
        n.nodeValue = originals.get(n);
      }
    });
  }

  function applyAttrs(root) {
    if (!root.querySelectorAll) return;
    // data-i18n="key" → textContent ; data-i18n-html="key" → innerHTML
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var kv = pair.split(':'); if (kv.length === 2) el.setAttribute(kv[0].trim(), t(kv[1].trim()));
      });
    });
  }

  function apply(root) {
    root = root || document.body;
    if (!root) return;
    translateTextNodes(root);
    applyAttrs(root);
  }

  function setHtmlState() {
    var html = document.documentElement;
    html.setAttribute('lang', state.lang);
    html.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
  }

  function injectFontsOnce() {
    if (document.getElementById('i18n-fonts')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Inter:wght@300;400;600;700;900&display=swap';
    document.head.appendChild(link);
    var st = document.createElement('style');
    st.id = 'i18n-fonts';
    st.textContent =
      'html[lang="ko"] body, html[lang="ko"] .font-cairo, html[lang="ko"] .font-tajawal, html[lang="ko"] h1, html[lang="ko"] h2, html[lang="ko"] h3, html[lang="ko"] h4, html[lang="ko"] h5 { font-family:"Noto Sans KR",sans-serif !important; }' +
      'html[lang="en"] body, html[lang="en"] .font-tajawal { font-family:"Inter","Segoe UI",system-ui,sans-serif !important; }' +
      'html[lang="en"] .font-cairo, html[lang="en"] h1, html[lang="en"] h2, html[lang="en"] h3, html[lang="en"] h4, html[lang="en"] h5 { font-family:"Inter","Segoe UI",system-ui,sans-serif !important; }';
    document.head.appendChild(st);
  }

  function emit() {
    setHtmlState();
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: state.lang } })); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(state.lang); } catch (e) {} });
  }

  function set(lang) {
    if (!LANGS[lang]) return;
    state.lang = lang;
    try { localStorage.setItem('alezz_lang', lang); } catch (e) {}
    setHtmlState();
    apply(document.body);
    emit();
  }

  state.lang = detect();
  injectFontsOnce();
  setHtmlState();

  function boot() { apply(document.body); emit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.I18N = {
    get lang() { return state.lang; },
    langs: LANGS,
    short: SHORT,
    set: set,
    t: t,
    apply: apply,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
