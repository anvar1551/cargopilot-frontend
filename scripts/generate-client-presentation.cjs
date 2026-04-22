/* eslint-disable no-console */
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const COLORS = {
  bg: "F8FAFC",
  dark: "0F172A",
  dark2: "1E293B",
  cyan: "0EA5E9",
  green: "10B981",
  slate: "334155",
  white: "FFFFFF",
  muted: "64748B",
  panel: "E2E8F0",
};

function addTopAccent(slide) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.18,
    fill: { color: COLORS.cyan },
    line: { color: COLORS.cyan },
  });
}

function addTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.8,
    y: 0.7,
    w: 11.9,
    h: 0.8,
    fontFace: "Segoe UI Semibold",
    fontSize: 32,
    color: COLORS.dark,
    bold: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8,
      y: 1.55,
      w: 11.9,
      h: 0.7,
      fontFace: "Segoe UI",
      fontSize: 15,
      color: COLORS.muted,
    });
  }
}

function addBullets(slide, items, startY = 2.2) {
  const lineH = 0.56;
  items.forEach((item, idx) => {
    const y = startY + idx * lineH;
    slide.addShape("roundRect", {
      x: 0.86,
      y: y + 0.09,
      w: 0.14,
      h: 0.14,
      rectRadius: 0.03,
      fill: { color: COLORS.cyan },
      line: { color: COLORS.cyan },
    });
    slide.addText(item, {
      x: 1.08,
      y,
      w: 11.5,
      h: 0.44,
      fontFace: "Segoe UI",
      fontSize: 19,
      color: COLORS.slate,
    });
  });
}

function addMetricCards(slide, cards) {
  const cardW = 3.95;
  cards.forEach((card, i) => {
    const x = 0.8 + i * 4.15;
    slide.addShape("roundRect", {
      x,
      y: 4.45,
      w: cardW,
      h: 1.5,
      rectRadius: 0.08,
      fill: { color: COLORS.white },
      line: { color: COLORS.panel, pt: 1 },
      shadow: { type: "outer", color: "94A3B8", blur: 2, angle: 45, distance: 1, opacity: 0.12 },
    });
    slide.addText(card.value, {
      x: x + 0.25,
      y: 4.73,
      w: cardW - 0.5,
      h: 0.42,
      fontFace: "Segoe UI Semibold",
      fontSize: 26,
      color: COLORS.dark,
      bold: true,
    });
    slide.addText(card.label, {
      x: x + 0.25,
      y: 5.18,
      w: cardW - 0.5,
      h: 0.36,
      fontFace: "Segoe UI",
      fontSize: 13,
      color: COLORS.muted,
    });
  });
}

function addFooter(slide, text) {
  slide.addText(text, {
    x: 0.8,
    y: 6.95,
    w: 9.6,
    h: 0.25,
    fontFace: "Segoe UI",
    fontSize: 10,
    color: "94A3B8",
  });
}

function createCoverSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.22,
    fill: { color: COLORS.cyan },
    line: { color: COLORS.cyan },
  });
  slide.addShape("roundRect", {
    x: 8.9,
    y: 0.9,
    w: 4,
    h: 4,
    rectRadius: 0.15,
    fill: { color: COLORS.dark2, transparency: 15 },
    line: { color: COLORS.dark2, transparency: 100 },
  });
  slide.addText("CargoPilot", {
    x: 0.8,
    y: 1.1,
    w: 8,
    h: 0.8,
    fontFace: "Segoe UI Semibold",
    fontSize: 44,
    color: COLORS.white,
    bold: true,
  });
  slide.addText("Цифровая операционная платформа для современной логистики", {
    x: 0.8,
    y: 2.05,
    w: 7.8,
    h: 0.7,
    fontFace: "Segoe UI",
    fontSize: 17,
    color: "CBD5E1",
  });
  slide.addText("Презентация для клиента", {
    x: 0.8,
    y: 3.0,
    w: 5.2,
    h: 0.5,
    fontFace: "Segoe UI",
    fontSize: 14,
    color: COLORS.green,
    bold: true,
  });
  addFooter(slide, "CargoPilot • 2026");
}

function createContentSlide(pptx, title, subtitle, bullets, footer) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };
  addTopAccent(slide);
  addTitle(slide, title, subtitle);
  addBullets(slide, bullets, 2.2);
  addFooter(slide, footer);
}

function buildDeck() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CargoPilot";
  pptx.company = "CargoPilot";
  pptx.subject = "Client pitch deck";
  pptx.title = "CargoPilot - Коммерческая презентация";
  pptx.lang = "ru-RU";

  createCoverSlide(pptx);

  createContentSlide(
    pptx,
    "Проблема рынка",
    "Почему логистические команды теряют деньги и скорость",
    [
      "Разрозненные инструменты: Excel, чаты и звонки без единого контура управления.",
      "Низкая прозрачность статусов: руководитель видит проблему слишком поздно.",
      "Ошибки в ручных процессах приводят к задержкам и финансовым потерям.",
      "Нет единой зоны ответственности по ролям и операциям.",
    ],
    "2 / 12"
  );

  createContentSlide(
    pptx,
    "Наше решение",
    "Единая система для операционного и финансового контроля",
    [
      "Role-based платформа: менеджер, склад, клиент работают в отдельных кабинетах.",
      "Dispatch Center для живой очереди, массовых операций и быстрых решений.",
      "Контроль денег и операционных KPI в одном интерфейсе.",
      "Готовность к масштабированию без хаоса в процессах.",
    ],
    "3 / 12"
  );

  const features = pptx.addSlide();
  features.background = { color: COLORS.bg };
  addTopAccent(features);
  addTitle(
    features,
    "Ключевые возможности",
    "Функциональность, которая дает прямой бизнес-эффект"
  );
  addBullets(features, [
    "Dispatch Center: фильтры, поиск, batch-операции, контроль очереди.",
    "Управление заказами: назначение водителя и массовые переходы статусов.",
    "Справочники: клиенты, водители, склады, прайсинг и SLA-правила.",
    "Клиентский кабинет: создание отправлений, отслеживание, CSV импорт.",
  ], 2.2);
  addMetricCards(features, [
    { value: "3x", label: "быстрее обработка операционных задач" },
    { value: "↓ Ошибки", label: "меньше ручных ошибок и дублирования" },
    { value: "24/7", label: "прозрачность статусов и очередей" },
  ]);
  addFooter(features, "4 / 12");

  createContentSlide(
    pptx,
    "Финансовый контроль",
    "Прозрачное движение наличных и ответственность по каждому этапу",
    [
      "Очереди cash-операций: сбор, передача, закрытие с фиксируемыми событиями.",
      "История операций и контроль расхождений на уровне заказа и сотрудника.",
      "Снижение спорных кейсов благодаря структурированному процессу.",
      "Готовая база для будущей автоматизации сверок.",
    ],
    "5 / 12"
  );

  createContentSlide(
    pptx,
    "Аналитика для руководителя",
    "Решения на данных, а не на интуиции",
    [
      "Дашборды по статусам, нагрузке, узким местам и скорости обработки.",
      "Операционные и финансовые срезы для контроля эффективности команды.",
      "Быстрая реакция на отклонения через live-представление данных.",
      "Единая управленческая картина без ручной консолидации отчетов.",
    ],
    "6 / 12"
  );

  createContentSlide(
    pptx,
    "Роли и безопасность",
    "Четкое разграничение прав и действий",
    [
      "Менеджер: полный контроль, аналитика, диспетчеризация, справочники.",
      "Склад: только складские операции и соответствующие статусы.",
      "Клиент: создание заказов, импорт, отслеживание своих отправлений.",
      "Контроль доступа снижает риски и повышает дисциплину процессов.",
    ],
    "7 / 12"
  );

  createContentSlide(
    pptx,
    "Один день в CargoPilot",
    "Как платформа работает в реальном операционном цикле",
    [
      "Заказы поступают в единую очередь и сразу видны диспетчеру.",
      "Менеджер выполняет batch-назначение и обновление статусов.",
      "Склад и водитель обрабатывают свои этапы в рамках роли.",
      "Руководитель видит KPI и денежные потоки в режиме онлайн.",
    ],
    "8 / 12"
  );

  createContentSlide(
    pptx,
    "Бизнес-эффект",
    "Что получает компания после внедрения",
    [
      "Ускорение операционных процессов и рост пропускной способности.",
      "Снижение потерь из-за ошибок и непрозрачных переходов.",
      "Единый контроль заказов, денег и исполнительской дисциплины.",
      "Подготовленная цифровая база для масштабирования бизнеса.",
    ],
    "9 / 12"
  );

  createContentSlide(
    pptx,
    "Roadmap развития",
    "Следующие шаги для усиления качества сервиса",
    [
      "POD-подтверждение доставки: подпись получателя на экране устройства.",
      "Офлайн-режим для доставки и синхронизация после восстановления связи.",
      "Автоматическая очистка локальных данных после безопасной загрузки.",
      "Расширенный аудит и контроль спорных кейсов.",
    ],
    "10 / 12"
  );

  createContentSlide(
    pptx,
    "План внедрения",
    "Быстрый запуск с измеримым результатом",
    [
      "Неделя 1: аудит процессов и настройка ролевой модели.",
      "Неделя 2: запуск ядра (dispatch + cash control + контроль статусов).",
      "Неделя 3: обучение команды и фиксация KPI до/после.",
      "Неделя 4: стабилизация, оптимизация и подготовка к масштабированию.",
    ],
    "11 / 12"
  );

  const cta = pptx.addSlide();
  cta.background = { color: COLORS.dark };
  cta.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.22,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  cta.addText("Давайте запустим пилот", {
    x: 0.8,
    y: 1.4,
    w: 9.5,
    h: 0.8,
    fontFace: "Segoe UI Semibold",
    fontSize: 40,
    color: COLORS.white,
    bold: true,
  });
  cta.addText(
    "14 дней пилота • прозрачные KPI • быстрый бизнес-результат",
    {
      x: 0.8,
      y: 2.35,
      w: 9.7,
      h: 0.55,
      fontFace: "Segoe UI",
      fontSize: 18,
      color: "CBD5E1",
    }
  );
  cta.addShape("roundRect", {
    x: 0.8,
    y: 3.15,
    w: 4.2,
    h: 0.7,
    rectRadius: 0.08,
    fill: { color: COLORS.cyan },
    line: { color: COLORS.cyan },
  });
  cta.addText("Старт проекта на этой неделе", {
    x: 1.1,
    y: 3.36,
    w: 3.7,
    h: 0.32,
    fontFace: "Segoe UI Semibold",
    fontSize: 14,
    color: COLORS.white,
    bold: true,
  });
  addFooter(cta, "12 / 12");

  const outputPath = path.resolve(
    process.cwd(),
    "docs",
    "CargoPilot_Client_Presentation_RU.pptx"
  );
  return pptx.writeFile({ fileName: outputPath }).then(() => outputPath);
}

buildDeck()
  .then((filePath) => {
    console.log(filePath);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
