import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

let Lucide = {} as any;
try {
  Lucide = require("lucide-react");
} catch (e) {
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const KELVIN_ZERO = 273.15;

function cToF(c: number) { return (c * 9) / 5 + 32; }

const WEATHER_MAP: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear", emoji: "☀️" },
  1: { label: "Mainly Clear", emoji: "🌤️" },
  2: { label: "Partly Cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Rime Fog", emoji: "🌫️" },
  51: { label: "Drizzle Light", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Drizzle Heavy", emoji: "🌧️" },
  56: { label: "Freezing Drizzle Light", emoji: "🌧️❄️" },
  57: { label: "Freezing Drizzle Heavy", emoji: "🌧️❄️" },
  61: { label: "Rain Light", emoji: "🌧️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Rain Heavy", emoji: "🌧️" },
  66: { label: "Freezing Rain Light", emoji: "🌧️❄️" },
  67: { label: "Freezing Rain Heavy", emoji: "🌧️❄️" },
  71: { label: "Snow Light", emoji: "🌨️" },
  73: { label: "Snow", emoji: "🌨️" },
  75: { label: "Snow Heavy", emoji: "❄️" },
  77: { label: "Snow Grains", emoji: "❄️" },
  80: { label: "Showers Light", emoji: "🌦️" },
  81: { label: "Showers", emoji: "🌦️" },
  82: { label: "Showers Heavy", emoji: "⛈️" },
  85: { label: "Snow Showers Light", emoji: "🌨️" },
  86: { label: "Snow Showers Heavy", emoji: "❄️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm Hail", emoji: "⛈️🧊" },
  99: { label: "Thunderstorm Severe", emoji: "⛈️🧊" },
};

function codeToWeather(w: number) {
  return WEATHER_MAP[w] ?? { label: "Unknown", emoji: "🌡️" };
}

function gradientForWeather(code: number) {
  if ([0, 1].includes(code)) return "from-indigo-400 via-purple-400 to-pink-400";
  if ([2, 3, 45, 48].includes(code)) return "from-slate-600 via-slate-700 to-purple-800";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "from-violet-700 via-indigo-800 to-slate-900";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "from-blue-700 via-indigo-800 to-slate-900";
  if ([95, 96, 99].includes(code)) return "from-slate-900 via-indigo-900 to-purple-900";
  return "from-purple-700 via-indigo-800 to-slate-900";
}

function useDebounced<T>(value: T, delay = 350) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setD(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return d;
}

export default function WeatherApp() {
  const [query, setQuery] = useState("New Delhi");
  const [unit, setUnit] = useState<"C" | "F">("C");
  const debounced = useDebounced(query);

  const [places, setPlaces] = useState<any[]>([]);
  const [place, setPlace] = useState<{ name: string; country: string; lat: number; lon: number } | null>(null);
  const [weather, setWeather] = useState<any | null>(null);
  const [selectedDay, setSelectedDay] = useState(0); // 0 = today
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debounced) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            debounced
          )}&count=5&language=en&format=json`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error("Failed to search");
        const json = await res.json();
        setPlaces(json?.results ?? []);
      } catch (e: any) {
        if (e.name !== "AbortError") console.error(e);
      }
    })();
    return () => ctrl.abort();
  }, [debounced]);

  useEffect(() => {
    if (!place) return;
    setLoading(true);
    setError(null);
    const { lat, lon } = place;
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current_weather", "true");
    url.searchParams.set(
      "hourly",
      ["temperature_2m", "precipitation_probability", "weathercode"].join(",")
    );
    url.searchParams.set(
      "daily",
      [
        "weathercode",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
      ].join(",")
    );
    url.searchParams.set("timezone", "auto");

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((j) => setWeather(j))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [place?.lat, place?.lon]);

  useEffect(() => {
    if (!place && places?.[0]) {
      const p = places[0];
      setPlace({ name: p.name, country: p.country, lat: p.latitude, lon: p.longitude });
    }
  }, [places]);

  const currentCode = weather?.current_weather?.weathercode ?? 2;
  const g = gradientForWeather(currentCode);

  const hourlyToday = useMemo(() => {
    if (!weather) return [] as any[];
    const { hourly } = weather;
    const today = new Date().toDateString();
    const out: any[] = [];
    hourly.time.forEach((t: string, i: number) => {
      const d = new Date(t);
      if (d.toDateString() === today) {
        out.push({
          time: d,
          temp: hourly.temperature_2m[i],
          pop: hourly.precipitation_probability?.[i] ?? null,
          code: hourly.weathercode?.[i] ?? null,
        });
      }
    });
    return out;
  }, [weather]);

  const days = useMemo(() => {
    if (!weather) return [] as any[];
    const d = weather.daily;
    return d.time.map((t: string, i: number) => ({
      date: new Date(t),
      code: d.weathercode[i],
      tmax: d.temperature_2m_max[i],
      tmin: d.temperature_2m_min[i],
      pop: d.precipitation_probability_max?.[i] ?? null,
    }));
  }, [weather]);

  function fmtTemp(c: number) {
    return unit === "C" ? Math.round(c) : Math.round(cToF(c));
  }

  function locateMe() {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords as any;
        setPlace({ name: "My Location", country: "", lat, lon });
      },
      (err) => alert(err.message)
    );
  }

  function CloudScene() {
    return (
      <div className="relative h-40 w-full select-none">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80 }}
          className="mx-auto mt-2 flex h-28 w-36 items-center justify-center rounded-3xl bg-white/90 shadow-xl"
        >
          <span className="text-4xl">{codeToWeather(currentCode).emoji}</span>
        </motion.div>
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 20 + (i % 3) * 6, opacity: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.6 + i * 0.1 }}
              className="absolute left-1/2 h-3 w-2 -translate-x-1/2 rounded-b-full bg-sky-300/70"
              style={{ left: `${35 + i * 6}%` }}
            />
          ))}
        </div>
        <motion.div
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-0 left-1/2 w-48 -translate-x-1/2"
        >
          <div className="mx-auto h-20 w-full rounded-2xl bg-indigo-600 shadow-2xl">
            <div className="flex gap-1 p-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 w-6 rounded bg-yellow-300/80 shadow-inner" />
              ))}
            </div>
            <div className="mx-auto h-2 w-24 rounded-full bg-indigo-800" />
          </div>
          <div className="-mt-3 mx-auto h-6 w-40 rounded-xl bg-slate-200" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cx(
      "min-h-screen w-full text-white",
      "bg-gradient-to-br",
      g,
      "flex items-center justify-center p-4"
    )}>
      <div className="w-full max-w-md rounded-3xl bg-white/5 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city..."
                className="w-full rounded-2xl border border-white/10 bg-white/10 p-3 pl-10 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/30"
              />
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-70">🔎</div>
              {!!places.length && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-slate-900/90 ring-1 ring-white/10">
                  {places.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPlace({ name: p.name, country: p.country, lat: p.latitude, lon: p.longitude });
                        setQuery(`${p.name}, ${p.country_code ?? p.country}`);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/10"
                    >
                      <span>
                        {p.name}{p.admin1 ? `, ${p.admin1}` : ""}
                        {p.country ? `, ${p.country}` : ""}
                      </span>
                      <span className="text-xs opacity-60">{p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setUnit((u) => (u === "C" ? "F" : "C"))}
            className="ml-2 shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/20"
            aria-label="Toggle unit"
          >
            °{unit}
          </button>

          <button
            onClick={locateMe}
            className="ml-2 shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/20"
            aria-label="Use my location"
          >
            📍
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
          <div className="text-center text-sm opacity-80">
            {place ? (
              <span>
                {place.name}
                {place.country ? `, ${place.country}` : ""}
              </span>
            ) : (
              <span>Choose a place</span>
            )}
          </div>

          {loading && (
            <div className="py-8 text-center text-white/80">Loading weather…</div>
          )}
          {error && (
            <div className="py-8 text-center text-red-200">{error}</div>
          )}

          {weather && !loading && (
            <>
              <CloudScene />

              <div className="mt-2 text-center">
                <div className="text-6xl font-bold leading-none drop-shadow-sm">
                  {fmtTemp(weather.current_weather.temperature)}°
                </div>
                <div className="mt-1 text-sm opacity-80">
                  {codeToWeather(currentCode).label}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Precipitation: {days[0]?.pop ?? 0}% ·
                  Max: {fmtTemp(days[0]?.tmax ?? 0)}° · Min: {fmtTemp(days[0]?.tmin ?? 0)}°
                </div>
              </div>
            </>
          )}
        </div>

        {hourlyToday?.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1 text-sm opacity-80">
              <span>Today</span>
              <span>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 pt-1">
              {hourlyToday.map((h, i) => (
                <div
                  key={i}
                  className="min-w-[70px] rounded-2xl bg-white/10 p-2 text-center ring-1 ring-white/10"
                >
                  <div className="text-xs opacity-75">
                    {h.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-xl">{fmtTemp(h.temp)}°</div>
                  <div className="text-lg">{codeToWeather(h.code).emoji}</div>
                  <div className="text-[10px] opacity-70">{h.pop ?? 0}% rain</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {days?.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 px-1 text-sm opacity-80">Next 7 Days</div>
            <div className="grid grid-cols-1 gap-2">
              {days.slice(0, 7).map((d, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={cx(
                    "flex items-center justify-between rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/10",
                    i === selectedDay && "bg-white/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{codeToWeather(d.code).emoji}</div>
                    <div>
                      <div className="text-sm">
                        {d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div className="text-xs opacity-70">{codeToWeather(d.code).label}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      {fmtTemp(d.tmax)}° / {fmtTemp(d.tmin)}°
                    </div>
                    <div className="text-xs opacity-70">{d.pop ?? 0}% rain</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-6 text-xs opacity-70">
          <span>Powered by Open‑Meteo</span>
          <a className="underline hover:text-white" href="#" onClick={(e) => { e.preventDefault(); alert("Tip: Type a city name, then choose a result. Use 📍 for your location, and toggle °C/°F. This is a single‑file React component you can drop into any project."); }}>Help</a>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
