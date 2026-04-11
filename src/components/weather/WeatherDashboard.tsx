'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WeatherReading, ChartRow, MeteoblueForecastEntry, CwaForecastPeriod } from './types';
import CurrentConditions from './CurrentConditions';
import WindCard from './WindCard';
import RainCard from './RainCard';
import SunMoonCard from './SunMoonCard';
import CwaForecastCard from './CwaForecastCard';
import CloudSeeingGrid from './CloudSeeingGrid';
import WeatherChart from './WeatherChart';
import MeteoblueEmbeds from './MeteoblueEmbeds';
import AllSkyCamera from './AllSkyCamera';
import MeteogramEmbed from './MeteogramEmbed';

const REFRESH_MS = 15_000;
const CWA_REFRESH_MS = 10 * 60 * 1000;

export default function WeatherDashboard() {
  const t = useTranslations('weather');
  const [latest, setLatest] = useState<WeatherReading | null>(null);
  const [cloudForecast, setCloudForecast] = useState<MeteoblueForecastEntry[]>([]);
  const [cwaForecast, setCwaForecast] = useState<CwaForecastPeriod[]>([]);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [chartHours, setChartHours] = useState(12);
  const [loading, setLoading] = useState(true);

  const fetchLatest = async () => {
    try {
      const res = await fetch('/api/weather/latest');
      if (res.ok) {
        const data = await res.json() as WeatherReading;
        setLatest(data);
        setLoading(false);
      }
    } catch { /* silent */ }
  };

  const fetchCwa = async () => {
    try {
      const res = await fetch('/api/weather/forecast/cwa');
      if (res.ok) {
        const data = await res.json() as { forecast: CwaForecastPeriod[] };
        setCwaForecast(data.forecast ?? []);
      }
    } catch { /* silent */ }
  };

  const fetchCloud = async () => {
    try {
      const res = await fetch('/api/weather/forecast/cloud');
      if (res.ok) {
        const data = await res.json() as MeteoblueForecastEntry[];
        setCloudForecast(data);
      }
    } catch { /* silent */ }
  };

  const fetchChart = async (hours: number) => {
    try {
      const res = await fetch(`/api/weather/chart?hours=${hours}`);
      if (res.ok) {
        const data = await res.json() as ChartRow[];
        setChartData(data);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchLatest();
    fetchCwa();
    fetchCloud();
    fetchChart(chartHours);

    const latestInterval = setInterval(fetchLatest, REFRESH_MS);
    const cwaInterval = setInterval(fetchCwa, CWA_REFRESH_MS);
    return () => {
      clearInterval(latestInterval);
      clearInterval(cwaInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchChart(chartHours);
  }, [chartHours]);

  const lastUpdate = latest
    ? new Date(latest.consoleTime).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  if (loading) {
    return (
      <div className="py-20 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        Loading weather data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Last update */}
      <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
        {t('lastUpdate')}: {lastUpdate}
      </p>

      {/* Current conditions */}
      <CurrentConditions reading={latest} />

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WindCard reading={latest} />
        <RainCard reading={latest} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SunMoonCard reading={latest} />
        <CwaForecastCard periods={cwaForecast} />
      </div>

      {/* Cloud & Seeing forecast */}
      {cloudForecast.length > 0 && (
        <CloudSeeingGrid
          forecast={cloudForecast}
          stationDate={latest?.stationDate ?? ''}
          stationTime={latest?.stationTime ?? ''}
        />
      )}

      {/* Historical chart */}
      <WeatherChart
        data={chartData}
        hours={chartHours}
        onHoursChange={(h) => setChartHours(h)}
        sunrise={latest?.sunrise}
        sunset={latest?.sunset}
      />

      {/* Map embeds */}
      <MeteoblueEmbeds />

      {/* All-sky camera placeholder */}
      <AllSkyCamera />

      {/* 5-day meteogram */}
      <MeteogramEmbed />
    </div>
  );
}
