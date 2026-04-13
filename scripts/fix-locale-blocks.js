const fs = require('fs');

function replaceBlock(path, managerBlock, importBlock) {
  const content = fs.readFileSync(path, 'utf8');
  const pattern = /  "managerCustomerPage": \{[\s\S]*?\n  \},\n  "bulkOrderImport": \{[\s\S]*?\n  \},\n  "createOrder": \{/;
  const replacement = `${managerBlock}\r\n${importBlock}\r\n  "createOrder": {`;
  const updated = content.replace(pattern, replacement);
  if (updated === content) {
    throw new Error(`Pattern not found in ${path}`);
  }
  fs.writeFileSync(path, updated, 'utf8');
}

const enManager = `  "managerCustomerPage": {
    "backToCustomers": "Back to customers",
    "notAvailableTitle": "Customer unavailable",
    "notAvailableSubtitle": "This customer record could not be loaded. Check the ID or refresh the page.",
    "profileBadge": "Customer profile",
    "heroSubtitle": "Single-shipment creation and controlled CSV imports stay attached to this customer entity so manager-side operations remain aligned with the live customer profile and address book.",
    "stat": {
      "orders": "Orders",
      "users": "Users",
      "savedAddresses": "Saved addresses",
      "since": "Since"
    },
    "field": {
      "email": "Email",
      "primaryPhone": "Primary phone",
      "company": "Company",
      "created": "Created",
      "legalName": "Legal name",
      "taxId": "Tax ID",
      "alternatePhone1": "Alternate phone 1",
      "alternatePhone2": "Alternate phone 2",
      "defaultAddress": "Default address"
    },
    "notSet": "Not set",
    "noSavedAddressYet": "No saved addresses yet.",
    "profileTitle": "Customer profile",
    "savedAddressesTitle": "Saved addresses",
    "emptySavedAddresses": "No saved addresses yet. Managers can create shipments from this page and save pickup or delivery addresses into the customer's address book.",
    "addressFallback": "ADDRESS",
    "importHint": "CSV import is intentionally limited to the controlled v1 template. This keeps bulk creation safe and aligned with the live order form."
  },`;

const enImport = `  "bulkOrderImport": {
    "trigger": "Bulk import",
    "title": "Bulk import orders",
    "description": "Import CSV orders for {customerLabel}. Use the system template so the file structure stays aligned with the live order model.",
    "summaryTitle": "Template-first import",
    "summaryHint": "Export Excel as CSV UTF-8, then validate before import.",
    "workflowTitle": "Workflow",
    "workflowStep1": "Download the standard template.",
    "workflowStep2": "Fill one shipment per row.",
    "workflowStep3": "Upload the CSV file.",
    "workflowStep4": "Validate the preview and confirm import.",
    "downloadTemplate": "Download template",
    "csvFile": "CSV file",
    "loadedFile": "Loaded file: {fileName}",
    "noFileSelected": "No file selected yet.",
    "validate": "Validate",
    "importValidRows": "Import valid rows",
    "previewEmptyTitle": "Preview is empty",
    "previewEmptyHint": "Upload a CSV file and run validation. The preview will show row-level issues before anything is created.",
    "rows": "Rows",
    "valid": "Valid",
    "invalid": "Invalid",
    "validationPreview": "Validation preview",
    "showingFirstRows": "Showing the first {count} row(s)",
    "ofRows": " of {count}",
    "row": "Row",
    "status": "Status",
    "receiver": "Receiver",
    "route": "Route",
    "service": "Service",
    "issues": "Issues",
    "noIssues": "No issues",
    "templateDownloaded": "Template downloaded",
    "templateDownloadFailed": "Failed to download template",
    "previewInvalidRows": "Preview contains invalid rows",
    "previewReady": "Preview ready: {count} valid row(s)",
    "validateFailed": "Failed to validate CSV",
    "importSuccess": "Imported {count} orders",
    "importFailed": "Failed to import orders",
    "readFileFailed": "Failed to read file"
  },`;

const ruManager = `  "managerCustomerPage": {
    "backToCustomers": "Назад к клиентам",
    "notAvailableTitle": "Клиент недоступен",
    "notAvailableSubtitle": "Не удалось загрузить карточку клиента. Проверьте ID или обновите страницу.",
    "profileBadge": "Профиль клиента",
    "heroSubtitle": "Создание одиночных отправок и контролируемый CSV-импорт привязаны к этой сущности клиента, чтобы действия менеджера оставались согласованными с живым профилем клиента и адресной книгой.",
    "stat": {
      "orders": "Заказы",
      "users": "Пользователи",
      "savedAddresses": "Сохраненные адреса",
      "since": "С нами с"
    },
    "field": {
      "email": "Email",
      "primaryPhone": "Основной телефон",
      "company": "Компания",
      "created": "Создан",
      "legalName": "Юридическое имя",
      "taxId": "ИНН",
      "alternatePhone1": "Дополнительный телефон 1",
      "alternatePhone2": "Дополнительный телефон 2",
      "defaultAddress": "Адрес по умолчанию"
    },
    "notSet": "Не указано",
    "noSavedAddressYet": "Сохраненных адресов пока нет.",
    "profileTitle": "Профиль клиента",
    "savedAddressesTitle": "Сохраненные адреса",
    "emptySavedAddresses": "Сохраненных адресов пока нет. Менеджеры могут создавать отправки с этой страницы и сохранять адреса забора или доставки в адресную книгу клиента.",
    "addressFallback": "АДРЕС",
    "importHint": "CSV-импорт намеренно ограничен контролируемым шаблоном v1. Это делает массовое создание безопасным и исключает расхождения с живой формой заказа."
  },`;

const ruImport = `  "bulkOrderImport": {
    "trigger": "Массовый импорт",
    "title": "Массовый импорт заказов",
    "description": "Импортируйте CSV-заказы для {customerLabel}. Используйте системный шаблон, чтобы структура файла оставалась совместимой с живой моделью заказа.",
    "summaryTitle": "Импорт по шаблону",
    "summaryHint": "Экспортируйте Excel в CSV UTF-8, затем выполните проверку перед импортом.",
    "workflowTitle": "Процесс",
    "workflowStep1": "Скачайте стандартный шаблон.",
    "workflowStep2": "Заполните одну отправку на строку.",
    "workflowStep3": "Загрузите CSV-файл.",
    "workflowStep4": "Проверьте превью и подтвердите импорт.",
    "downloadTemplate": "Скачать шаблон",
    "csvFile": "CSV-файл",
    "loadedFile": "Загружен файл: {fileName}",
    "noFileSelected": "Файл пока не выбран.",
    "validate": "Проверить",
    "importValidRows": "Импортировать валидные строки",
    "previewEmptyTitle": "Превью пустое",
    "previewEmptyHint": "Загрузите CSV-файл и запустите проверку. Превью покажет ошибки по строкам до создания данных.",
    "rows": "Строки",
    "valid": "Валидные",
    "invalid": "Невалидные",
    "validationPreview": "Превью проверки",
    "showingFirstRows": "Показаны первые {count} строк",
    "ofRows": " из {count}",
    "row": "Строка",
    "status": "Статус",
    "receiver": "Получатель",
    "route": "Маршрут",
    "service": "Услуга",
    "issues": "Проблемы",
    "noIssues": "Без проблем",
    "templateDownloaded": "Шаблон скачан",
    "templateDownloadFailed": "Не удалось скачать шаблон",
    "previewInvalidRows": "В превью есть невалидные строки",
    "previewReady": "Превью готово: {count} валидных строк",
    "validateFailed": "Не удалось проверить CSV",
    "importSuccess": "Импортировано {count} заказов",
    "importFailed": "Не удалось импортировать заказы",
    "readFileFailed": "Не удалось прочитать файл"
  },`;

const uzManager = `  "managerCustomerPage": {
    "backToCustomers": "Mijozlarga qaytish",
    "notAvailableTitle": "Mijoz topilmadi",
    "notAvailableSubtitle": "Mijoz kartasini yuklab bo'lmadi. ID ni tekshiring yoki sahifani yangilang.",
    "profileBadge": "Mijoz profili",
    "heroSubtitle": "Yagona jo'natma yaratish va nazorat qilinadigan CSV import shu mijoz birligiga bog'langan, shunda menejer amallari jonli mijoz profili va manzillar kitobi bilan mos qoladi.",
    "stat": {
      "orders": "Buyurtmalar",
      "users": "Foydalanuvchilar",
      "savedAddresses": "Saqlangan manzillar",
      "since": "Biz bilan"
    },
    "field": {
      "email": "Email",
      "primaryPhone": "Asosiy telefon",
      "company": "Kompaniya",
      "created": "Yaratilgan",
      "legalName": "Yuridik nom",
      "taxId": "STIR",
      "alternatePhone1": "Qo'shimcha telefon 1",
      "alternatePhone2": "Qo'shimcha telefon 2",
      "defaultAddress": "Asosiy manzil"
    },
    "notSet": "Ko'rsatilmagan",
    "noSavedAddressYet": "Hozircha saqlangan manzillar yo'q.",
    "profileTitle": "Mijoz profili",
    "savedAddressesTitle": "Saqlangan manzillar",
    "emptySavedAddresses": "Hozircha saqlangan manzillar yo'q. Menejerlar shu sahifadan jo'natma yaratib, olib ketish yoki yetkazish manzillarini mijoz manzillar kitobiga saqlashi mumkin.",
    "addressFallback": "MANZIL",
    "importHint": "CSV import ataylab nazorat qilinadigan v1 shablon bilan cheklangan. Bu ommaviy yaratishni xavfsiz qiladi va jonli buyurtma formasi bilan tafovutni oldini oladi."
  },`;

const uzImport = `  "bulkOrderImport": {
    "trigger": "Ommaviy import",
    "title": "Buyurtmalarni ommaviy import qilish",
    "description": "{customerLabel} uchun CSV buyurtmalarni import qiling. Fayl tuzilmasi jonli buyurtma modeliga mos qolishi uchun tizim shablonidan foydalaning.",
    "summaryTitle": "Shablon bo'yicha import",
    "summaryHint": "Excel faylni CSV UTF-8 ko'rinishida eksport qiling, keyin importdan oldin tekshiring.",
    "workflowTitle": "Jarayon",
    "workflowStep1": "Standart shablonni yuklab oling.",
    "workflowStep2": "Har bir qatorda bitta jo'natma kiriting.",
    "workflowStep3": "CSV faylni yuklang.",
    "workflowStep4": "Preview ni tekshirib, importni tasdiqlang.",
    "downloadTemplate": "Shablonni yuklab olish",
    "csvFile": "CSV fayl",
    "loadedFile": "Yuklangan fayl: {fileName}",
    "noFileSelected": "Hali fayl tanlanmagan.",
    "validate": "Tekshirish",
    "importValidRows": "Yaroqli qatorlarni import qilish",
    "previewEmptyTitle": "Preview bo'sh",
    "previewEmptyHint": "CSV faylni yuklang va tekshiruvni ishga tushiring. Preview ma'lumot yaratishdan oldin qator darajasidagi xatolarni ko'rsatadi.",
    "rows": "Qatorlar",
    "valid": "Yaroqli",
    "invalid": "Yaroqsiz",
    "validationPreview": "Tekshiruv preview si",
    "showingFirstRows": "Birinchi {count} ta qator ko'rsatilmoqda",
    "ofRows": " / {count}",
    "row": "Qator",
    "status": "Holat",
    "receiver": "Qabul qiluvchi",
    "route": "Yo'nalish",
    "service": "Xizmat",
    "issues": "Muammolar",
    "noIssues": "Muammo yo'q",
    "templateDownloaded": "Shablon yuklab olindi",
    "templateDownloadFailed": "Shablonni yuklab bo'lmadi",
    "previewInvalidRows": "Preview da yaroqsiz qatorlar bor",
    "previewReady": "Preview tayyor: {count} ta yaroqli qator",
    "validateFailed": "CSV ni tekshirib bo'lmadi",
    "importSuccess": "{count} ta buyurtma import qilindi",
    "importFailed": "Buyurtmalarni import qilib bo'lmadi",
    "readFileFailed": "Faylni o'qib bo'lmadi"
  },`;

replaceBlock('c:/Users/Anvar/Documents/my projects/cargopilot-frontend/lib/i18n/messages/en.ts', enManager, enImport);
replaceBlock('c:/Users/Anvar/Documents/my projects/cargopilot-frontend/lib/i18n/messages/ru.ts', ruManager, ruImport);
replaceBlock('c:/Users/Anvar/Documents/my projects/cargopilot-frontend/lib/i18n/messages/uz.ts', uzManager, uzImport);
console.log('Locale blocks updated.');
