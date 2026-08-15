// ============================================================
// js/map.js - D3.js 日本地図レンダリング
// ============================================================

const JapanMap = (() => {
  const TOPO_URL = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.topojson';
  let topoData = null;
  let svgEl = null;
  let gEl = null;
  let projection = null;
  let pathGen = null;
  let currentUserId = null;
  let onPrefClick = null;
  let activeRegion = 'all';
  let mapFeatures = null;

  // 進捗カラー
  function _getPrefColor(prefId) {
    if (!currentUserId) return '#e8e4f0';
    const status = Progress.getPrefStatus(currentUserId, prefId);
    if (status.step3) return '#6BCB77';   // 緑：Step3完了
    if (status.step2) return '#5DADE2';   // 青：Step2完了
    if (status.step1) return '#FFD93D';   // 黄：Step1完了
    return '#e8e4f0';                      // グレー：未挑戦
  }

  // 地図初期化
  async function init(svgId, userId, clickCallback) {
    svgEl = d3.select(`#${svgId}`);
    currentUserId = userId;
    onPrefClick = clickCallback;

    if (!topoData) {
      try {
        topoData = await d3.json(TOPO_URL);
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
      .center([137, 35.5])
      .scale(W * 2.8)
      .translate([W / 2, H / 2]);

    pathGen = d3.geoPath().projection(projection);

    const features = topojson.feature(topoData, topoData.objects.japan).features;
    mapFeatures = features;

    gEl = svgEl.append('g').attr('class', 'map-g');

    // 影エフェクト
    const defs = svgEl.append('defs');
    const filter = defs.append('filter').attr('id', 'drop-shadow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feDropShadow').attr('dx', '1').attr('dy', '2').attr('stdDeviation', '3').attr('flood-color', 'rgba(0,0,0,0.15)');

    gEl.selectAll('path')
      .data(features)
      .enter()
      .append('path')
      .attr('class', 'pref-path')
      .attr('d', pathGen)
      .attr('fill', d => {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return '#ddd';
        if (activeRegion !== 'all' && pref.region !== activeRegion) return '#e0dded';
        return _getPrefColor(pref.id);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.8)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('filter', 'url(#drop-shadow)')
      .style('cursor', 'pointer')
      .style('transition', 'fill 0.3s')
      .on('mouseover', function(event, d) {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return;
        d3.select(this).attr('fill', pref.color).attr('stroke-width', 1.5);
        // ツールチップ
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
          tooltip.textContent = pref.emoji + ' ' + pref.name;
          tooltip.style.left = (event.offsetX + 10) + 'px';
          tooltip.style.top = (event.offsetY - 10) + 'px';
          tooltip.classList.remove('hidden');
        }
      })
      .on('mouseout', function(event, d) {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return;
        d3.select(this).attr('fill', () => {
          if (activeRegion !== 'all' && pref.region !== activeRegion) return '#e0dded';
          return _getPrefColor(pref.id);
        }).attr('stroke-width', 0.8);
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
      })
      .on('click', function(event, d) {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return;
        _highlightPref(pref);
        if (onPrefClick) onPrefClick(pref);
        Speech.speakPrefName(pref);
      });

    // 都道府県名ラベル（関東・近畿等の小さい県にはラベルなし）
    _addLabels(features);
  }

  function _addLabels(features) {
    const container = svgEl.node().parentElement;
    const W = container.clientWidth || 500;
    const minArea = W < 600 ? 300 : 150;

    gEl.selectAll('text')
      .data(features)
      .enter()
      .append('text')
      .attr('class', 'pref-label')
      .attr('transform', d => {
        const centroid = pathGen.centroid(d);
        return `translate(${centroid})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('font-size', W < 600 ? '10px' : '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#444')
      .attr('pointer-events', 'none')
      .text(d => {
        const area = pathGen.area(d);
        if (area < minArea) return '';
        const pref = getPrefectureByName(d.properties.nam_ja);
        return pref ? pref.name.replace(/[都道府県]$/, '') : '';
      });
  }

  function _highlightPref(pref) {
    gEl.selectAll('path.pref-path')
      .attr('stroke-width', function(d) {
        return getPrefectureByName(d.properties.nam_ja)?.name === pref.name ? 2.5 : 0.8;
      })
      .attr('stroke', function(d) {
        return getPrefectureByName(d.properties.nam_ja)?.name === pref.name ? pref.color : '#fff';
      });
  }

  // 地方フィルタ
  function filterByRegion(region) {
    activeRegion = region;
    if (!gEl) return;

    const container = svgEl.node().parentElement;
    const W = container.clientWidth || 500;
    const H = container.clientHeight || 450;
    let scale = 1;
    let translate = [0, 0];

    if (region !== 'all' && mapFeatures) {
      const regionFeatures = mapFeatures.filter(f => {
        const pref = getPrefectureByName(f.properties.nam_ja);
        return pref && pref.region === region;
      });

      if (regionFeatures.length > 0) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        regionFeatures.forEach(f => {
          const bounds = pathGen.bounds(f);
          if (bounds[0][0] < x0) x0 = bounds[0][0];
          if (bounds[0][1] < y0) y0 = bounds[0][1];
          if (bounds[1][0] > x1) x1 = bounds[1][0];
          if (bounds[1][1] > y1) y1 = bounds[1][1];
        });
        const dx = x1 - x0; const dy = y1 - y0;
        const x = (x0 + x1) / 2; const y = (y0 + y1) / 2;
        scale = Math.max(1, Math.min(6, 0.85 / Math.max(dx / W, dy / H)));
        translate = [W / 2 - scale * x, H / 2 - scale * y];
      }
    }

    gEl.transition().duration(750)
      .attr('transform', `translate(${translate[0]},${translate[1]}) scale(${scale})`);

    gEl.selectAll('path.pref-path')
      .transition().duration(750)
      .attr('fill', d => {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return '#ddd';
        if (region !== 'all' && pref.region !== region) return '#e0dded';
        return _getPrefColor(pref.id);
      })
      .style('opacity', d => {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return 0.5;
        return region === 'all' || pref.region === region ? 1 : 0.4;
      });

    gEl.selectAll('text.pref-label')
      .transition().duration(750)
      .attr('font-size', (W < 600 ? 10 : 14) / scale + 'px');
  }

  // 進捗カラーを更新（解答後に呼ぶ）
  function updateColors() {
    if (!gEl) return;
    gEl.selectAll('path.pref-path')
      .transition().duration(500)
      .attr('fill', d => {
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return '#ddd';
        if (activeRegion !== 'all' && pref.region !== activeRegion) return '#e0dded';
        return _getPrefColor(pref.id);
      });
  }

  function setUser(userId) { currentUserId = userId; }

  // ミニマップ（Step1/2画面用）
  async function initMini(svgId, highlightPref) {
    const miniSvg = d3.select(`#${svgId}`);
    miniSvg.selectAll('*').remove();

    if (!topoData) {
      try { topoData = await d3.json(TOPO_URL); } catch { return; }
    }

    const container = miniSvg.node().parentElement;
    const W = container.clientWidth || 200;
    const H = container.clientHeight || 180;

    miniSvg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

    const features = topojson.feature(topoData, topoData.objects.japan).features;

    // 挑戦中の都道府県のエリアに合わせてズーム
    let targetGeo = { type: 'FeatureCollection', features: features };
    if (highlightPref) {
      const regionFeatures = features.filter(f => {
        const p = getPrefectureByName(f.properties.nam_ja);
        return p && p.region === highlightPref.region;
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
        const pref = getPrefectureByName(d.properties.nam_ja);
        if (!pref) return '#ddd';
        if (highlightPref && pref.name === highlightPref.name) return highlightPref.color;
        return '#e8e4f0';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5);
  }

  return { init, initMini, filterByRegion, updateColors, setUser };
})();
