import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type OSMCoordinate = { latitude: number; longitude: number };
export type OSMRegion = OSMCoordinate & { latitudeDelta?: number; longitudeDelta?: number };

export type OpenStreetMapMarker = {
  id: string;
  coordinate: OSMCoordinate;
  title?: string;
  description?: string | null;
  color?: string;
};

export type OpenStreetMapHandle = {
  animateCamera: (camera: { center?: OSMCoordinate }, options?: { duration?: number }) => void;
  animateToRegion: (region: OSMRegion, duration?: number) => void;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  initialRegion: OSMRegion;
  markers?: OpenStreetMapMarker[];
  onPress?: (coordinate: OSMCoordinate) => void;
  onMarkerPress?: (markerId: string) => void;
  children?: React.ReactNode;
};

export const OpenStreetMapView = forwardRef<OpenStreetMapHandle, Props>(function OpenStreetMapView(
  { style, initialRegion, markers = [], onPress, onMarkerPress },
  ref,
) {
  const webViewRef = useRef<WebView | null>(null);
  const markerPayload = useMemo(() => JSON.stringify(markers), [markers]);
  const initialHtml = useMemo(() => createOpenStreetMapHtml(initialRegion, markers), []);
  const source = useMemo(() => {
    const kakaoKey = getKakaoMapKey();
    const baseUrl = getKakaoMapBaseUrl();
    if (kakaoKey) {
      return { uri: `${baseUrl.replace(/\/$/, '')}/app/kakao-map?appkey=${encodeURIComponent(kakaoKey)}` };
    }
    return { html: initialHtml };
  }, [initialHtml]);

  useImperativeHandle(ref, () => ({
    animateCamera: (camera) => {
      if (camera.center) {
        postToMap(webViewRef.current, { type: 'center', coordinate: camera.center });
      }
    },
    animateToRegion: (region) => {
      postToMap(webViewRef.current, { type: 'center', coordinate: region });
    },
  }));

  useEffect(() => {
    postToMap(webViewRef.current, { type: 'markers', markers });
  }, [markerPayload]);

  return (
    <WebView
      ref={webViewRef}
      style={style}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      source={source}
      onLoadEnd={() => {
        postToMap(webViewRef.current, { type: 'center', coordinate: initialRegion });
        postToMap(webViewRef.current, { type: 'markers', markers });
      }}
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as
            | { type: 'press'; latitude: number; longitude: number }
            | { type: 'markerPress'; markerId: string };
          if (message.type === 'press') {
            onPress?.({ latitude: message.latitude, longitude: message.longitude });
          }
          if (message.type === 'markerPress') {
            onMarkerPress?.(message.markerId);
          }
        } catch {
          // Ignore malformed messages from the embedded map.
        }
      }}
    />
  );
});

function postToMap(webView: WebView | null, payload: unknown) {
  webView?.postMessage(JSON.stringify(payload));
}

function createMapHtml(initialRegion: OSMRegion, markers: OpenStreetMapMarker[]) {
  const kakaoKey = getKakaoMapKey();
  if (kakaoKey) {
    return createKakaoMapHtml(initialRegion, markers, kakaoKey);
  }
  return createOpenStreetMapHtml(initialRegion, markers);
}

function getKakaoMapKey() {
  return process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY?.trim();
}

function getKakaoMapBaseUrl() {
  return process.env.EXPO_PUBLIC_KAKAO_MAP_BASE_URL?.trim() || 'https://band-api-production.up.railway.app';
}

function createKakaoMapHtml(initialRegion: OSMRegion, markers: OpenStreetMapMarker[], kakaoKey: string) {
  const initialMarkers = JSON.stringify(markers);
  const center = JSON.stringify({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });
  const escapedKey = encodeURIComponent(kakaoKey);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f8fafc; }
    .marker-dot {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.3);
    }
    .map-status {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 10px;
      z-index: 9999;
      padding: 9px 11px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.92);
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 3px 14px rgba(15, 23, 42, 0.14);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="map-status" class="map-status">지도를 불러오는 중이에요</div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${escapedKey}&autoload=false" onerror="window.__kakaoMapFailed = true"></script>
  <script>
    const center = ${center};
    let activeProvider = 'kakao';
    let kakaoMap = null;
    let osmMap = null;
    let osmMarkerLayer = null;
    const kakaoMarkerStore = [];
    let currentMarkers = ${initialMarkers};

    function send(message) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function setStatus(message, autoHide) {
      const element = document.getElementById('map-status');
      if (!element) return;
      element.textContent = message;
      element.style.display = 'block';
      if (autoHide) {
        setTimeout(function() {
          element.style.display = 'none';
        }, 1600);
      }
    }

    function clearKakaoMarkers() {
      kakaoMarkerStore.forEach(function(marker) { marker.setMap(null); });
      kakaoMarkerStore.length = 0;
    }

    function renderKakaoMarkers(markers) {
      if (!kakaoMap || !window.kakao || !window.kakao.maps) return;
      clearKakaoMarkers();
      markers.forEach(function(marker) {
        const position = new kakao.maps.LatLng(marker.coordinate.latitude, marker.coordinate.longitude);
        const content =
          '<div class="marker-dot" style="background:' + (marker.color || '#2563eb') + '"></div>';
        const overlay = new kakao.maps.CustomOverlay({
          position: position,
          content: content,
          yAnchor: 0.5,
          xAnchor: 0.5,
        });
        overlay.setMap(kakaoMap);
        kakaoMarkerStore.push(overlay);
        const hitArea = new kakao.maps.Marker({ position: position, opacity: 0.01, clickable: true });
        hitArea.setMap(kakaoMap);
        kakaoMarkerStore.push(hitArea);
        kakao.maps.event.addListener(hitArea, 'click', function() {
          send({ type: 'markerPress', markerId: marker.id });
        });
      });
    }

    function renderOsmMarkers(markers) {
      if (!osmMarkerLayer || !window.L) return;
      osmMarkerLayer.clearLayers();
      markers.forEach(function(marker) {
        const color = marker.color || '#2563eb';
        const icon = L.divIcon({
          className: '',
          html: '<div class="marker-dot" style="background:' + color + '"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const leafletMarker = L.marker([marker.coordinate.latitude, marker.coordinate.longitude], { icon }).addTo(osmMarkerLayer);
        const text = [marker.title, marker.description].filter(Boolean).join('<br>');
        if (text) leafletMarker.bindPopup(text);
        leafletMarker.on('click', function() { send({ type: 'markerPress', markerId: marker.id }); });
      });
    }

    function renderMarkers(markers) {
      currentMarkers = markers || [];
      if (activeProvider === 'osm') {
        renderOsmMarkers(currentMarkers);
        return;
      }
      renderKakaoMarkers(currentMarkers);
    }

    function initKakaoMap() {
      activeProvider = 'kakao';
      const container = document.getElementById('map');
      kakaoMap = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(center.latitude, center.longitude),
        level: 5,
      });
      kakao.maps.event.addListener(kakaoMap, 'click', function(mouseEvent) {
        const latlng = mouseEvent.latLng;
        send({ type: 'press', latitude: latlng.getLat(), longitude: latlng.getLng() });
      });
      setStatus('카카오맵으로 표시 중이에요', true);
      renderKakaoMarkers(currentMarkers);
    }

    function loadLeaflet(callback) {
      if (window.L) {
        callback();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = callback;
      script.onerror = function() {
        setStatus('지도를 불러오지 못했어요. 인터넷 연결을 확인해주세요.', false);
      };
      document.head.appendChild(script);
    }

    function initOsmMap() {
      activeProvider = 'osm';
      clearKakaoMarkers();
      const container = document.getElementById('map');
      container.innerHTML = '';
      osmMap = L.map('map', { zoomControl: true }).setView([center.latitude, center.longitude], 13);
      osmMarkerLayer = L.layerGroup().addTo(osmMap);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(osmMap);
      osmMap.on('click', function(event) {
        send({ type: 'press', latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      setStatus('카카오맵을 불러오지 못해 기본 지도로 표시해요', true);
      renderOsmMarkers(currentMarkers);
    }

    function fallbackToOsm() {
      if (activeProvider === 'osm') return;
      loadLeaflet(initOsmMap);
    }

    function startKakaoMap() {
      const timeout = setTimeout(fallbackToOsm, 3500);
      try {
        if (window.__kakaoMapFailed || !window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
          clearTimeout(timeout);
          fallbackToOsm();
          return;
        }
        kakao.maps.load(function() {
          clearTimeout(timeout);
          try {
            initKakaoMap();
          } catch (error) {
            fallbackToOsm();
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        fallbackToOsm();
      }
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'markers') {
          renderMarkers(message.markers || []);
        }
        if (message.type === 'center' && message.coordinate) {
          if (activeProvider === 'kakao' && kakaoMap) {
            kakaoMap.setCenter(new kakao.maps.LatLng(message.coordinate.latitude, message.coordinate.longitude));
          }
          if (activeProvider === 'osm' && osmMap) {
            osmMap.setView([message.coordinate.latitude, message.coordinate.longitude], Math.max(osmMap.getZoom(), 13));
          }
        }
      } catch (error) {}
    }

    window.addEventListener('error', function(event) {
      const source = String(event.filename || '');
      if (source.indexOf('dapi.kakao.com') >= 0 || source.indexOf('kakao') >= 0) {
        fallbackToOsm();
      }
    });

    startKakaoMap();
  </script>
</body>
</html>`;
}

function createOpenStreetMapHtml(initialRegion: OSMRegion, markers: OpenStreetMapMarker[]) {
  const initialMarkers = JSON.stringify(markers);
  const center = JSON.stringify({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #eef2ff; }
    .marker-dot {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = ${center};
    const map = L.map('map', { zoomControl: true }).setView([center.latitude, center.longitude], 13);
    const markerLayer = L.layerGroup().addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    function send(message) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function renderMarkers(markers) {
      markerLayer.clearLayers();
      markers.forEach(function(marker) {
        const color = marker.color || '#2563eb';
        const icon = L.divIcon({
          className: '',
          html: '<div class="marker-dot" style="background:' + color + '"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const leafletMarker = L.marker([marker.coordinate.latitude, marker.coordinate.longitude], { icon }).addTo(markerLayer);
        const text = [marker.title, marker.description].filter(Boolean).join('<br>');
        if (text) leafletMarker.bindPopup(text);
        leafletMarker.on('click', function() { send({ type: 'markerPress', markerId: marker.id }); });
      });
    }

    map.on('click', function(event) {
      send({ type: 'press', latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'markers') {
          renderMarkers(message.markers || []);
        }
        if (message.type === 'center' && message.coordinate) {
          map.setView([message.coordinate.latitude, message.coordinate.longitude], Math.max(map.getZoom(), 13));
        }
      } catch (error) {}
    }

    renderMarkers(${initialMarkers});
  </script>
</body>
</html>`;
}
