import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('app')
export class KakaoMapController {
  @Get('kakao-map')
  kakaoMap(@Query('appkey') appkey: string | undefined, @Res() res: Response) {
    const escapedKey = encodeURIComponent((appkey ?? '').trim());

    res.type('html').send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
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
      background: rgba(255, 255, 255, 0.94);
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 3px 14px rgba(15, 23, 42, 0.14);
      pointer-events: none;
    }
    .map-status.error {
      color: #b91c1c;
      background: rgba(255, 242, 242, 0.96);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="map-status" class="map-status">카카오맵을 불러오는 중이에요</div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${escapedKey}&autoload=false" onerror="window.__kakaoMapFailed = true"></script>
  <script>
    let activeProvider = 'kakao';
    let center = { latitude: 37.5665, longitude: 126.9780 };
    let kakaoMap = null;
    let osmMap = null;
    let osmMarkerLayer = null;
    let currentMarkers = [];
    const kakaoMarkerStore = [];

    function send(message) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function setStatus(message, mode, autoHide) {
      const element = document.getElementById('map-status');
      if (!element) return;
      element.textContent = message;
      element.className = mode === 'error' ? 'map-status error' : 'map-status';
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
        const content = '<div class="marker-dot" style="background:' + (marker.color || '#2563eb') + '"></div>';
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
        leafletMarker.on('click', function() {
          send({ type: 'markerPress', markerId: marker.id });
        });
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
      setStatus('카카오맵 정상 로딩 완료', 'ok', true);
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
        setStatus('지도를 불러오지 못했어요. 인터넷 연결을 확인해주세요.', 'error', false);
      };
      document.head.appendChild(script);
    }

    function initOsmMap(reason) {
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
      setStatus(reason || '카카오맵 설정을 확인해주세요. 기본 지도로 표시 중이에요.', 'error', false);
      renderOsmMarkers(currentMarkers);
    }

    function fallbackToOsm(reason) {
      if (activeProvider === 'osm') return;
      loadLeaflet(function() { initOsmMap(reason); });
    }

    function startKakaoMap() {
      const timeout = setTimeout(function() {
        fallbackToOsm('카카오맵 응답이 지연돼 기본 지도로 표시 중이에요. 카카오맵 사용 설정/도메인을 확인해주세요.');
      }, 5000);
      try {
        if (window.__kakaoMapFailed || !window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
          clearTimeout(timeout);
          fallbackToOsm('카카오맵 SDK 로딩 실패. 카카오맵 사용 설정/JavaScript SDK 도메인을 확인해주세요.');
          return;
        }
        kakao.maps.load(function() {
          clearTimeout(timeout);
          try {
            initKakaoMap();
          } catch (error) {
            fallbackToOsm('카카오맵 초기화 실패. 카카오맵 사용 설정/JavaScript SDK 도메인을 확인해주세요.');
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        fallbackToOsm('카카오맵 실행 오류. 카카오맵 사용 설정/JavaScript SDK 도메인을 확인해주세요.');
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
          center = message.coordinate;
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
        fallbackToOsm('카카오맵 SDK 오류. 카카오맵 사용 설정/JavaScript SDK 도메인을 확인해주세요.');
      }
    });

    startKakaoMap();
  </script>
</body>
</html>`);
  }
}
