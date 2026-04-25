export async function getCoordinates(locationName) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude
      };
    }
    return null;
  } catch (err) {
    console.error("Geocoding failed for", locationName, err);
    return null;
  }
}

export async function getCurrentWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`);
    const data = await res.json();
    if (data.current) {
      return {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m
      };
    }
    return null;
  } catch (err) {
    console.error("Weather fetch failed", err);
    return null;
  }
}

export async function getTomorrowForecast(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,temperature_2m_max&timezone=auto`);
    const data = await res.json();
    if (data.daily) {
      return {
        isRainExpected: data.daily.precipitation_sum[1] > 0,
        rainAmount: data.daily.precipitation_sum[1],
        maxTemp: data.daily.temperature_2m_max[1]
      };
    }
    return null;
  } catch (err) {
    console.error("Forecast fetch failed", err);
    return null;
  }
}
