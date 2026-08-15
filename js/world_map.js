// ============================================================
// js/world_map.js - D3.js 世界地図レンダリング
// ============================================================

const WorldMap = (() => {
  const GEO_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
  let geoData = null;
  let svgEl = null;
  let gEl = null;
  let projection = null;
  let pathGen = null;
  let currentUserId = null;
  let onCountryClick = null;
  let mapFeatures = null;

  // 進捗カラー（Prefectureと同様にs1のクリア状況を見る）
  function _getCountryColor(countryId) {
    if (!currentUserId) return '#e8e4f0';
    // 世界地図モードは「国名を漢字/カタカナで書く」だけを想定
    const status = Progress.getPrefStatus(currentUserId, countryId);
    if (status.step1) return '#6BCB77'; // 緑：クリア
    return '#e8e4f0'; // グレー：未挑戦
  }

  // 地図初期化
  async function init(svgId, userId, clickCallback) {
    svgEl = d3.select(`#${svgId}`);
    currentUserId = userId;
    onCountryClick = clickCallback;

    if (!geoData) {
      try {
        geoData = await d3.json(GEO_URL);
      } catch (err) {
        svgEl.append('text').attr('x', '50%').attr('y', '50%')
          .attr('text-anchor', 'middle').text('地図を読み込めませんでした');
        return;
      }
    }
    _render();
  }

  function _render() {
    svgEl.selectAll('*').remove();

    const container = svgEl.node().parentElement;
    const W = container.clientWidth || 500;
    const H = container.clientHeight || 450;

    svgEl.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

    projection = d3.geoMercator()
      .scale(W / 2 / Math.PI)
      .translate([W / 2, H / 1.5]);

    pathGen = d3.geoPath().projection(projection);
    mapFeatures = geoData.features;

    gEl = svgEl.append('g').attr('class', 'map-g');

    // 影エフェクト
    const defs = svgEl.append('defs');
    const filter = defs.append('filter').attr('id', 'drop-shadow-world').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feDropShadow').attr('dx', '1').attr('dy', '2').attr('stdDeviation', '3').attr('flood-color', 'rgba(0,0,0,0.15)');

    gEl.selectAll('path')
      .data(mapFeatures)
      .enter()
      .append('path')
      .attr('class', 'pref-path') // 既存のクラスを再利用
      .attr('d', pathGen)
      .attr('fill', d => {
        const c = getCountryByName(d.properties.name);
        if (!c) return '#e0e0e0'; // 対象外の国は薄いグレー
        return _getCountryColor(c.id);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('filter', 'url(#drop-shadow-world)')
      .style('cursor', d => getCountryByName(d.properties.name) ? 'pointer' : 'default')
      .style('transition', 'fill 0.3s')
      .on('mouseover', function(event, d) {
        const c = getCountryByName(d.properties.name);
        if (!c) return;
        d3.select(this).attr('fill', c.color).attr('stroke-width', 1.5);
        // ツールチップ
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
          tooltip.textContent = c.emoji + ' ' + c.name;
          tooltip.style.left = (event.offsetX + 10) + 'px';
          tooltip.style.top = (event.offsetY - 10) + 'px';
          tooltip.classList.remove('hidden');
        }
      })
      .on('mouseout', function(event, d) {
        const c = getCountryByName(d.properties.name);
        if (!c) return;
        d3.select(this).attr('fill', () => _getCountryColor(c.id)).attr('stroke-width', 0.5);
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
      })
      .on('click', function(event, d) {
        const c = getCountryByName(d.properties.name);
        if (!c) return;
        _highlightCountry(c);
        if (onCountryClick) onCountryClick(c);
        Speech.speakPrefName(c);
      });

    // 国名ラベル
    _addLabels(mapFeatures);
  }

  function _addLabels(features) {
    const container = svgEl.node().parentElement;
    const W = container.clientWidth || 500;
    const minArea = W < 600 ? 500 : 300;

    gEl.selectAll('text')
      .data(features)
      .enter()
      .append('text')
      .attr('class', 'pref-label')
      .attr('transform', d => {
        const centroid = pathGen.centroid(d);
        if (isNaN(centroid[0])) return 'translate(-100,-100)';
        return `translate(${centroid})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('font-size', W < 600 ? '5px' : '7px')
      .attr('fill', '#444')
      .attr('pointer-events', 'none')
      .text(d => {
        const area = pathGen.area(d);
        if (area < minArea) return '';
        const c = getCountryByName(d.properties.name);
        return c ? c.name : '';
      });
  }

  function _highlightCountry(c) {
    gEl.selectAll('path.pref-path')
      .attr('stroke-width', function(d) {
        return getCountryByName(d.properties.name)?.name === c.name ? 2.5 : 0.5;
      })
      .attr('stroke', function(d) {
        return getCountryByName(d.properties.name)?.name === c.name ? c.color : '#fff';
      });
  }

  function filterByRegion(region) {
    // 世界地図では現在はズーム不要（すべて表示）
  }

  function updateColors() {
    if (!gEl) return;
    gEl.selectAll('path.pref-path')
      .transition().duration(500)
      .attr('fill', d => {
        const c = getCountryByName(d.properties.name);
        if (!c) return '#e0e0e0';
        return _getCountryColor(c.id);
      });
  }

  function setUser(userId) { currentUserId = userId; }

  // ミニマップ（Step1画面用）
  async function initMini(svgId, highlightCountry) {
    const miniSvg = d3.select(`#${svgId}`);
    miniSvg.selectAll('*').remove();

    if (!geoData) {
      try { geoData = await d3.json(GEO_URL); } catch { return; }
    }

    const container = miniSvg.node().parentElement;
    const W = container.clientWidth || 200;
    const H = container.clientHeight || 180;

    miniSvg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

    const features = geoData.features;

    // 対象の国にズーム
    let targetGeo = { type: 'FeatureCollection', features: features };
    if (highlightCountry) {
      const regionFeatures = features.filter(f => {
        const c = getCountryByName(f.properties.name);
        return c && c.name === highlightCountry.name;
      });
      if (regionFeatures.length > 0) {
        targetGeo = { type: 'FeatureCollection', features: regionFeatures };
      }
    }

    const proj = d3.geoMercator()
      .fitExtent([[15, 15], [W - 15, H - 15]], targetGeo);
      
    const pg = d3.geoPath().projection(proj);

    miniSvg.append('g').selectAll('path')
      .data(features)
      .enter()
      .append('path')
      .attr('d', pg)
      .attr('fill', d => {
        const c = getCountryByName(d.properties.name);
        if (!c) return '#f5f5f5';
        if (highlightCountry && c.name === highlightCountry.name) return highlightCountry.color;
        return '#e8e4f0';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5);
  }

  return { init, initMini, filterByRegion, updateColors, setUser };
})();
