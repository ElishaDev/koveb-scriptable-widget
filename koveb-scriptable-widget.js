let station = args.widgetParameter;

station = station
  .replace(" ", "+")
  .replace("\u00df", "ss")
  .replace("\u00fc", "ue")
  .replace("\u00e4", "ae")
  .replace("\u00f6", "oe");

const DEPARTURE_API_ENDPOINT =
  "https://liniennetz.koveb.de/api/journeyplanners/ass/ass-stop/%s/departures?locale=de-de";
const AUTH_ENDPOINT = "https://liniennetz.koveb.de/";

let authRequest = new Request(AUTH_ENDPOINT);
await authRequest.loadString();
let htmlBody = await authRequest.loadString();
let cookies = authRequest.response.cookies;
let csrfToken = htmlBody.split('<meta name="csrf-token" content="').pop().split('">')[0];
let xsrfToken = cookies.find(cookie => cookie.name === "XSRF-TOKEN")?.value || "";

let stationIDRequest = new Request(
  `https://liniennetz.koveb.de/api/journeyplanners/ass/places?idRequired=0&locale=de-de&term=${station}`
);
stationIDRequest.method = "GET";
stationIDRequest.headers = {
  "X-CSRF-TOKEN": csrfToken,
  "X-XSRF-TOKEN": xsrfToken,
};
let stationData = await stationIDRequest.loadJSON();
const stationTitle = stationData[0].title;
const stationID = stationData[0].ASSID;

let departureRequest = new Request(
  `https://liniennetz.koveb.de/api/journeyplanners/ass/ass-stop/${stationID}/departures?locale=de-de`
);
departureRequest.method = "GET";
departureRequest.headers = {
  "X-CSRF-TOKEN": csrfToken,
  "X-XSRF-TOKEN": xsrfToken,
};
let departures = await departureRequest.loadJSON();

const widgetSize = config.widgetFamily || "large";
const widget = await createWidget();

if (!config.runInWidget) {
  switch (widgetSize) {
    case "small": await widget.presentSmall(); break;
    case "large": await widget.presentLarge(); break;
    default: await widget.presentMedium();
  }
}

Script.setWidget(widget);
Script.complete();

function createWidget() {
  let count, headerSize, rowHeight, spacing, padding, logoSize, stationSize, timeSize, logoFontSize, stationFontSize, timeFontSize, headlineFontSize, footerHeight, footerFontSize;

  if (widgetSize === "small") {
    count = 4; headerSize = 20; rowHeight = 15; spacing = 3;
    logoSize = new Size(20, rowHeight); stationSize = new Size(45, rowHeight); timeSize = new Size(35, rowHeight);
    logoFontSize = 12; stationFontSize = 14; timeFontSize = 12; headlineFontSize = 16; footerHeight = 20; footerFontSize = 6;
  } else if (widgetSize === "medium") {
    count = 3; headerSize = 25; rowHeight = 20; spacing = 5;
    logoSize = new Size(35, rowHeight); stationSize = new Size(185, rowHeight); timeSize = new Size(60, rowHeight);
    logoFontSize = 14; stationFontSize = 16; timeFontSize = 16; headlineFontSize = 24; footerHeight = 10; footerFontSize = 8;
  } else {
    count = 8; headerSize = 30; rowHeight = 20; spacing = 5;
    logoSize = new Size(35, rowHeight); stationSize = new Size(165, rowHeight); timeSize = new Size(80, rowHeight);
    logoFontSize = 14; stationFontSize = 16; timeFontSize = 16; headlineFontSize = 24; footerHeight = 25; footerFontSize = 8;
  }

  padding = spacing;

  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1C1C1E");
  widget.setPadding(padding, padding, padding, padding);

  const mainStack = widget.addStack();
  mainStack.layoutVertically();
  mainStack.centerAlignContent();

  const headerStack = mainStack.addStack();
  headerStack.layoutVertically();
  headerStack.size = new Size(logoSize.width + stationSize.width + timeSize.width + 2 * spacing, headerSize);
  const title = headerStack.addText(stationTitle);
  title.textColor = Color.white();
  title.leftAlignText();
  title.font = Font.boldSystemFont(headlineFontSize);

  mainStack.addSpacer(8);

  for (let i = 0; i < count; i++) {
    const rowStack = mainStack.addStack();
    rowStack.spacing = spacing;
    rowStack.size = new Size(logoSize.width + stationSize.width + timeSize.width + 2 * spacing, rowHeight + 2 * spacing);
    rowStack.layoutHorizontally();
    rowStack.centerAlignContent();

    const lineStack = rowStack.addStack();
    lineStack.size = logoSize;
    lineStack.centerAlignContent();
    lineStack.backgroundColor = Color.purple();
    const line = lineStack.addText(departures[i].line.toString());
    line.font = Font.boldSystemFont(logoFontSize);
    line.textColor = Color.white();
    line.centerAlignText();
    line.minimumScaleFactor = 0.4;

    const destinationStack = rowStack.addStack();
    destinationStack.size = stationSize;
    destinationStack.layoutVertically();
    destinationStack.bottomAlignContent();
    const destination = destinationStack.addText(truncate(departures[i].direction.toString(), 25));
    destination.font = Font.lightSystemFont(stationFontSize);
    destination.textColor = Color.white();
    destination.leftAlignText();
    destination.minimumScaleFactor = 0.95;

    const timeStack = rowStack.addStack();
    timeStack.size = timeSize;
    timeStack.bottomAlignContent();

    let ext = (widgetSize === "medium" || widgetSize === "large") ? " Min" : "";

    let depTime = new Date(departures[i].time);
    const h = depTime.getHours().toString().padStart(2, '0');
    const m = depTime.getMinutes().toString().padStart(2, '0');
    const timeText = timeStack.addText(`${h}:${m}`);
    timeText.font = Font.boldSystemFont(timeFontSize);

    if (departures[i].has_realtime) {
      let schedTime = new Date(departures[i].time_scheduled);
      let delay = getMinutesBetweenDates(schedTime, depTime);
      if (delay === 0) {
        timeText.textColor = Color.green();
      } else {
        timeText.textColor = Color.red();
        timeStack.addText(`(+${delay})`);
      }
    }

    timeText.rightAlignText();
    timeText.minimumScaleFactor = 0.95;
  }

  const footerStack = mainStack.addStack();
  footerStack.bottomAlignContent();
  footerStack.size = new Size(logoSize.width + stationSize.width + timeSize.width + 2 * spacing, footerHeight);
  const df = new DateFormatter();
  df.useMediumTimeStyle();
  const lastUpdate = df.string(new Date());
  const footer = footerStack.addText("Letztes Update: " + lastUpdate);
  footer.font = Font.lightSystemFont(footerFontSize);
  footer.textColor = Color.white();
  footer.rightAlignText();
  footer.textOpacity = 0.6;
  footer.minimumScaleFactor = 0.95;

  return widget;
}

function truncate(text, maxLength) {
  return text.length > maxLength ? text.substr(0, maxLength - 3) + '...' : text;
}

function getMinutesBetweenDates(start, end) {
  return Math.floor((end - start) / (1000 * 60));
}