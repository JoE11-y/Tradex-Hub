import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTradingStore } from '../store/tradingStore';

export function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const prevCandleCountRef = useRef<number>(0);

  const candles = useTradingStore((s) => s.candles);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1729' },
        textColor: '#9ca3af',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#6366f1', width: 1, style: 2 },
        horzLine: { color: '#6366f1', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6366f180',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const sma20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b80',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20SeriesRef.current = sma20Series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
    };
  }, []);

  // Compute 20-period SMA from candle close prices
  function computeSma20(data: typeof candles): { time: UTCTimestamp; value: number }[] {
    const period = 20;
    const result: { time: UTCTimestamp; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
      result.push({ time: data[i].time as UTCTimestamp, value: sum / period });
    }
    return result;
  }

  // Update candle data -- incremental update when only the last candle changed
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) {
      prevCandleCountRef.current = 0;
      return;
    }

    const prevCount = prevCandleCountRef.current;
    const last = candles[candles.length - 1];

    // Incremental update: same count (last candle updated) or exactly one new candle appended
    const isIncremental = prevCount > 0 && (candles.length === prevCount || candles.length === prevCount + 1);

    if (isIncremental) {
      candleSeriesRef.current.update({
        time: last.time as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
      volumeSeriesRef.current.update({
        time: last.time as UTCTimestamp,
        value: last.volume,
        color: last.close >= last.open ? '#22c55e40' : '#ef444440',
      });
      if (sma20SeriesRef.current && candles.length >= 20) {
        let sum = 0;
        for (let j = candles.length - 20; j < candles.length; j++) sum += candles[j].close;
        sma20SeriesRef.current.update({ time: last.time as UTCTimestamp, value: sum / 20 });
      }
    } else {
      // Full reload (asset/interval change or initial load)
      const candleData = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      const volumeData = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? '#22c55e40' : '#ef444440',
      }));
      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      sma20SeriesRef.current?.setData(computeSma20(candles));
    }

    prevCandleCountRef.current = candles.length;

    // Auto-scroll to latest
    chartRef.current?.timeScale().scrollToRealTime();
  }, [candles]);

  return (
    <div className="h-full w-full relative">
      <div ref={chartContainerRef} className="h-full w-full" />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f1729]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading chart data...</span>
          </div>
        </div>
      )}
    </div>
  );
}
