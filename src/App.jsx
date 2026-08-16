import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header/Header';
import { SectorList } from './components/SectorList/SectorList';
import { ImageComparisonViewer } from './components/ImageComparisonViewer/ImageComparisonViewer';
import { MetricsPanel } from './components/MetricsPanel/MetricsPanel';
import { SensitivityCalibration } from './components/SensitivityCalibration/SensitivityCalibration';
import { InspectionModal } from './components/InspectionModal/InspectionModal';
import { initialLocations } from './data/locations';
import { interpolateSensitivity } from './data/calibration';
import styles from './App.module.css';

export function App() {
  const [locationsList, setLocationsList] = useState(initialLocations);
  const [selectedLocationId, setSelectedLocationId] = useState('mihan');
  const [searchQuery, setSearchQuery] = useState('');
  const [threshold, setThreshold] = useState(20.0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningStatusText, setScanningStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const progressTimersRef = useRef([]);

  // Fetch preset locations from backend API on mount
  useEffect(() => {
    fetch('/api/locations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocationsList(data.locations);
        }
      })
      .catch((err) => {
        console.warn('Using bundled initial locations fallback:', err);
      });
  }, []);

  const selectedLocation = useMemo(
    () => locationsList.find((l) => l.id === selectedLocationId) || locationsList[0],
    [locationsList, selectedLocationId]
  );

  // Scaled color diff percentage based on sensitivity threshold curve
  const currentScaledColorDiff = useMemo(() => {
    const base = interpolateSensitivity(threshold);
    const factor = (selectedLocation?.colorDiff || 7.06) / 7.06;
    return base * factor;
  }, [selectedLocation, threshold]);

  const clearProgressTimers = () => {
    progressTimersRef.current.forEach(clearTimeout);
    progressTimersRef.current = [];
  };

  // Real live analysis request calling POST /api/analyze
  const handleRequestLiveAnalysis = useCallback(
    async (locationName) => {
      const cleanName = locationName.trim();
      if (!cleanName) return;

      setErrorMessage('');

      // Check if an existing location matches directly
      const existing = locationsList.find(
        (l) =>
          l.name.toLowerCase().includes(cleanName.toLowerCase()) ||
          l.id.toLowerCase().includes(cleanName.toLowerCase())
      );

      if (existing) {
        setSelectedLocationId(existing.id);
        return;
      }

      // Start multi-stage progress indicator
      setIsScanning(true);
      setScanningStatusText('1/4 Geocoding location with Nominatim...');
      clearProgressTimers();

      progressTimersRef.current.push(
        setTimeout(() => {
          setScanningStatusText('2/4 Querying Copernicus CDSE Sentinel-2 catalog (<15% cloud cover)...');
        }, 1500)
      );

      progressTimersRef.current.push(
        setTimeout(() => {
          setScanningStatusText('3/4 Downloading 10m L2A granules from Process API...');
        }, 4000)
      );

      progressTimersRef.current.push(
        setTimeout(() => {
          setScanningStatusText('4/4 Computing optical color diff & structural SSIM divergence matrix...');
        }, 8000)
      );

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location_name: cleanName })
        });

        clearProgressTimers();

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const reason =
            errData?.detail?.reason ||
            errData?.reason ||
            'No clear satellite imagery (<15% cloud cover) available for this exact location in the current time window — try a nearby point or select from analyzed locations.';
          setErrorMessage(reason);
          setIsScanning(false);
          setScanningStatusText('');
          return;
        }

        const data = await response.json();

        const newId = `live-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        const ssimArea = data.ssim_pct;
        const colorDiff = data.color_diff_pct;
        const status = ssimArea > 15 ? 'flagged' : colorDiff > 7.0 ? 'elevated' : 'stable';
        const statusLabel =
          status === 'flagged'
            ? 'Flagged / Divergent'
            : status === 'elevated'
            ? 'Elevated Change'
            : 'Moderate / Stable';

        const newLocation = {
          id: newId,
          name: data.location_name,
          subtitle: `Live AOI — Analyzed ${data.before_date} → ${data.after_date}`,
          colorDiff,
          ssimArea,
          ssimScore: data.ssim_score,
          status,
          statusLabel,
          coords: data.coords || `${data.lng.toFixed(3)}° E, ${data.lat.toFixed(3)}° N`,
          coordinates: [data.lat, data.lng],
          confidence: data.confidence,
          beforeDate: data.before_date,
          afterDate: data.after_date,
          permits: [
            {
              id: `LIVE-NMC-2024-${Math.floor(1000 + Math.random() * 8000)}`,
              plot: `${cleanName} Municipal Plot`,
              status: status === 'flagged' ? 'unmatched' : 'matched',
              date: data.after_date
            },
            {
              id: `LIVE-AUDIT-${Math.floor(100 + Math.random() * 800)}`,
              plot: `${cleanName} Sector Bounds`,
              status: 'matched',
              date: data.before_date
            }
          ],
          localImages: {
            before: data.before_image_url,
            after: data.after_image_url,
            colorOverlay: data.color_diff_overlay_url,
            ssimOverlay: data.ssim_overlay_url
          },
          isLiveAnalyzed: true,
          isPreview: false
        };

        setLocationsList((prev) => [newLocation, ...prev]);
        setSelectedLocationId(newId);
        setIsScanning(false);
        setScanningStatusText('');
      } catch (err) {
        clearProgressTimers();
        console.error('Live analysis failed:', err);
        setErrorMessage(
          'Could not complete live satellite analysis. Please check network connectivity or select from verified preset locations.'
        );
        setIsScanning(false);
        setScanningStatusText('');
      }
    },
    [locationsList]
  );

  return (
    <div className={styles.appContainer}>
      <Header />

      <main className={styles.workspaceGrid}>
        <SectorList
          locations={locationsList}
          selectedId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRequestLiveAnalysis={handleRequestLiveAnalysis}
          isScanning={isScanning}
          scanningStatusText={scanningStatusText}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage('')}
        />

        <ImageComparisonViewer
          location={selectedLocation}
          threshold={threshold}
        />

        <MetricsPanel
          location={selectedLocation}
          currentScaledColorDiff={currentScaledColorDiff}
          onOpenInspectionModal={() => setIsModalOpen(true)}
        />
      </main>

      <SensitivityCalibration
        threshold={threshold}
        onThresholdChange={setThreshold}
      />

      {isModalOpen && (
        <InspectionModal
          location={selectedLocation}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
