const xrpl = require('xrpl');

/*
===============================================================================
                    UTILS - Token price query
===============================================================================

This script queries the XRP Ledger for the price of a token pair.
It checks both the order book (CLOB) and AMM to find the best available price.

===============================================================================
*/

/**
 * Convert currency code to hex format (except XRP)
 * @param {string} currency - Currency code (3-6 chars) or hex
 * @returns {string} Hex representation padded to 40 chars
 */
function toHexCurrency(currency) {
    if (/^[A-F0-9]{40}$/.test(currency)) {
        return currency;
    }
    if (currency.length < 3 || currency.length > 6) {
        throw new Error("Currency code must be 3 to 6 characters long.");
    }
    let hex = Buffer.from(currency, "ascii").toString("hex").toUpperCase();
    return hex.padEnd(40, '0');
}

/**
 * Calculate AMM spot price 
 * @param {Object} amm - AMM object from amm_info response
 * @param {Object} baseAsset - Base currency object {currency, issuer?}
 * @returns {number} Price of quote asset in terms of base asset
 */
function calculateAMMPrice(amm, baseAsset) {
  const asset1 = amm.amount;
  const asset2 = amm.amount2;
  
  let baseAmount, quoteAmount;
  
  // Determine which asset is base
  const asset1IsBase = (typeof asset1 === 'string' && baseAsset.currency === 'XRP') ||
                       (typeof asset1 === 'object' && asset1.currency === baseAsset.currency);
  
  if (asset1IsBase) {
    baseAmount = typeof asset1 === 'string' ? parseFloat(asset1) / 1_000_000 : parseFloat(asset1.value);
    quoteAmount = typeof asset2 === 'string' ? parseFloat(asset2) / 1_000_000 : parseFloat(asset2.value);
  } else {
    baseAmount = typeof asset2 === 'string' ? parseFloat(asset2) / 1_000_000 : parseFloat(asset2.value);
    quoteAmount = typeof asset1 === 'string' ? parseFloat(asset1) / 1_000_000 : parseFloat(asset1.value);
  }
  
  return quoteAmount / baseAmount;
}

/**
 * Calculate order book price from offer
 * @param {Object} offer - Offer object from book_offers response
 * @param {Object} baseAsset - Base currency object {currency, issuer?}
 * @returns {number} Price of TakerGets in terms of TakerPays
 */
function calculateOrderBookPrice(offer, baseAsset) {
  const takerGets = offer.TakerGets;
  const takerPays = offer.TakerPays;
  
  let baseAmount, quoteAmount;
  
  // Determine which side is base
  const getsIsBase = (typeof takerGets === 'string' && baseAsset.currency === 'XRP') ||
                     (typeof takerGets === 'object' && takerGets.currency === baseAsset.currency);
  
  if (getsIsBase) {
    baseAmount = typeof takerGets === 'string' ? parseFloat(takerGets) / 1_000_000 : parseFloat(takerGets.value);
    quoteAmount = typeof takerPays === 'string' ? parseFloat(takerPays) / 1_000_000 : parseFloat(takerPays.value);
  } else {
    baseAmount = typeof takerPays === 'string' ? parseFloat(takerPays) / 1_000_000 : parseFloat(takerPays.value);
    quoteAmount = typeof takerGets === 'string' ? parseFloat(takerGets) / 1_000_000 : parseFloat(takerGets.value);
  }
  
  return quoteAmount / baseAmount;
}

/**
 * Get token pair price from XRPL
 * @param {string} baseCurrency - Base currency code or hex
 * @param {string|null} baseIssuer - Base issuer address (null for XRP)
 * @param {string} quoteCurrency - Quote currency code or hex
 * @param {string|null} quoteIssuer - Quote issuer address (null for XRP)
 * @returns {Object} Price data from order book and AMM
 */
async function getTokenPrice(baseCurrency, baseIssuer, quoteCurrency, quoteIssuer) {
  const client = new xrpl.Client('wss://xrplcluster.com');
  
  // Prepare currency objects
  const baseAsset = baseCurrency === 'XRP' 
    ? { currency: 'XRP' }
    : { currency: toHexCurrency(baseCurrency), issuer: baseIssuer };
  
  const quoteAsset = quoteCurrency === 'XRP'
    ? { currency: 'XRP' }
    : { currency: toHexCurrency(quoteCurrency), issuer: quoteIssuer };
  
  try {
    await client.connect();
    
    // Check order book (taker wants base, pays quote)
    const bookOffers = await client.request({
      command: 'book_offers',
      taker_gets: baseAsset,
      taker_pays: quoteAsset,
      limit: 10
    });
    
    const ledger_current_index = bookOffers.result.ledger_current_index;
    const bookPrice = bookOffers.result.offers[0] 
      ? calculateOrderBookPrice(bookOffers.result.offers[0], baseAsset) 
      : null;
    
    // Check AMM
    let ammPrice = null;
    try {
      const ammInfo = await client.request({
        command: 'amm_info',
        asset: baseAsset,
        asset2: quoteAsset
      });
      ammPrice = calculateAMMPrice(ammInfo.result.amm, baseAsset);
      console.log('AMM Price found:', ammPrice);
    } catch (e) {
      console.warn('AMM not found or error occurred:', e.message);
    }
    
    // Determine best price (lowest for buying)
    const bestPrice = (!bookPrice && ammPrice) ? ammPrice 
                    : (!ammPrice && bookPrice) ? bookPrice
                    : (ammPrice && bookPrice && ammPrice < bookPrice) ? ammPrice 
                    : bookPrice;
    
    const bestSource = (!bookPrice && ammPrice) ? 'AMM'
                     : (!ammPrice && bookPrice) ? 'OrderBook'
                     : (ammPrice && bookPrice && ammPrice < bookPrice) ? 'AMM'
                     : 'OrderBook';
    
    return {
      pair: `${baseCurrency}/${quoteCurrency}`,
      orderBookPrice: bookPrice,
      ammPrice: ammPrice,
      bestPrice: bestPrice,
      bestSource: bestSource,
      timestamp: ledger_current_index,
    };
    
  } finally {
    await client.disconnect();
  }
}

// Usage examples:

// XRP/RLUSD
getTokenPrice('XRP', null, 'RLUSD', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De')
  .then(result => console.log(result));

// RLUSD/USD (token pair)
// getTokenPrice('SOLO', 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz','RLUSD', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De')
//   .then(result => console.log(result));