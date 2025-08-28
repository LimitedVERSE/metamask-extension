import { useSelector } from 'react-redux';
import { getResolvedLocale } from '../ducks/locale/locale';

// TODO: Move this to @metamask/core

const twoDecimals = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const threeDecimals = {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
};

const compactTwoDecimals: Intl.NumberFormatOptions = {
  notation: 'compact',
  maximumFractionDigits: 2,
};

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getCachedNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions = {},
) {
  const key = `${locale}_${JSON.stringify(options)}`;

  if (!numberFormatCache.has(key)) {
    try {
      numberFormatCache.set(key, new Intl.NumberFormat(locale, options));
    } catch (error) {
      if (error instanceof RangeError) {
        // Fallback for invalid options (e.g. currency code)
        numberFormatCache.set(key, new Intl.NumberFormat(locale, twoDecimals));
      } else {
        throw error;
      }
    }
  }

  // Known TypeScript limitation with Map: https://github.com/microsoft/TypeScript/issues/9619
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return numberFormatCache.get(key)!;
}

function formatCurrency(
  config: { locale: string },
  value: number | bigint | `${number}`,
  currency: Intl.NumberFormatOptions['currency'],
  options: Intl.NumberFormatOptions = {},
) {
  if (!Number.isFinite(Number(value))) {
    return '';
  }

  const numberFormat = getCachedNumberFormat(config.locale, {
    style: 'currency',
    currency,
    ...options,
  });

  // Remove this once https://github.com/MetaMask/metamask-extension/pull/35433 is merged.
  // @ts-expect-error Because this project is using an older TypeScript version.
  return numberFormat.format(value);
}

function formatCurrencyCompact(
  config: { locale: string },
  value: number | bigint | `${number}`,
  currency: Intl.NumberFormatOptions['currency'],
) {
  return formatCurrency(config, value, currency, compactTwoDecimals);
}

function formatCurrencyWithThreshold(
  config: { locale: string },
  value: number | bigint | `${number}`,
  currency: Intl.NumberFormatOptions['currency'],
) {
  if (!Number.isFinite(Number(value))) {
    return '';
  }

  const number = Number(value);
  let options: Intl.NumberFormatOptions = {};

  if (number === 0) {
    return formatCurrency(config, 0, currency);
  } else if (number < 0.001) {
    const formatted = formatCurrency(config, 0.001, currency, threeDecimals);
    return `<${formatted}`;
  } else if (number < 0.01) {
    const formatted = formatCurrency(config, 0.01, currency, twoDecimals);
    return `<${formatted}`;
  } else if (number < 1) {
    options = threeDecimals;
  } else if (number < 1e6) {
    options = {};
  } else if (number < 1e15) {
    options = compactTwoDecimals;
  }

  return formatCurrency(config, number, currency, options);
}

export function createFormatters({ locale }: { locale: string }) {
  if (!locale) {
    throw new Error('Locale is required');
  }

  return {
    /**
     * Format a value as a currency string.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code (e.g. 'USD').
     * @param options - Optional Intl.NumberFormat overrides.
     */
    formatCurrency: formatCurrency.bind(null, { locale }),
    /**
     * Compact currency (e.g. $1.2K, $3.4M) with up to two decimal digits.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code.
     */
    formatCurrencyCompact: formatCurrencyCompact.bind(null, { locale }),
    /**
     * Currency with thresholds for small / large values.
     *
     * @param value - Numeric value to format.
     * @param currency - ISO 4217 currency code.
     */
    formatCurrencyWithThreshold: formatCurrencyWithThreshold.bind(null, {
      locale,
    }),
  };
}

const FALLBACK_LOCALE = 'en-US';

export function useFormatters() {
  const locale = useSelector(getResolvedLocale) || FALLBACK_LOCALE;

  return createFormatters({ locale });
}
