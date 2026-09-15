export interface NewsEvent {
  value: string;        // "FOMC_FUND_RATE"
  label: string;       // "FOMC Fund Rate"
}

export const NEWS_EVENTS: NewsEvent[] = [
  { value: "none", label: "No News" },
  { value: "FOMC_FUND_RATE", label: "FOMC Fund Rate" },
  { value: "NFP", label: "NFP" },
  { value: "FOMC_MINUTES", label: "FOMC Minutes" },
  { value: "CPI", label: "CPI" },
  { value: "ISM_MANUFACTURE", label: "ISM Manufacture" },
  { value: "GDP", label: "GDP" },
  { value: "CAD_GDP_MM", label: "CAD GDP m/m" },
  { value: "JOLTS_JOB", label: "JOLTS Job" },
  { value: "AUD_NEWS", label: "AUD News" },
  { value: "ADP_EM", label: "ADP Em." },
  { value: "ISM_SERVICE", label: "ISM Service" },
  { value: "UNEMPLOYE_CLAIM", label: "Unemploye claim" },
  { value: "EUR_MONETARY_FUND", label: "EUR Monetary Fund" },
  { value: "GBP_CLIMANT_CHANGE", label: "GBP Climant Change" },
  { value: "EMPIRE_STATE_MANUFACTURE_INDEX", label: "Empire State Manufacture Index" },
  { value: "RETAIL_SALES", label: "Retail Sales" },
  { value: "CAD_CPI", label: "CAD CPI" },
  { value: "GBP_CPI", label: "GBP CPI" },
  { value: "FLASH_MANUFACTURE", label: "Flash manufacture" },
  { value: "FED_CHAIR_POWELL_SPEAK", label: "Fed Chair Powell Speak" },
  { value: "PRELIM_UOM_CONSUMER_SENTIMENT", label: "Prelim UoM Consumer Sentiment" },
];

export function getNewsEventLabel(value: string): string {
  return NEWS_EVENTS.find(e => e.value === value)?.label ?? value;
}
