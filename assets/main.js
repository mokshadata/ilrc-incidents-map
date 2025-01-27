(function () {
  async function handleCountiesLoaded(data) {
    const [countiesPromise, formDataPromise] = data;
    const counties = await countiesPromise;
    const formTXT = await formDataPromise;

    const newLine = new RegExp("\r?\n")
    const [headerRow, ...formRows] = formTXT.split(newLine);

    const headers = headerRow.split("\t");
    const entries = formRows
      .map(function (formRow) {
        return formRow.split("\t").map(function (value) { return value.replaceAll('"', '').trim()});
      })
      .filter(function (formRowSplit) {
        return formRowSplit.length === headers.length;
      })
      .map(function (formRowSplit) {
        let rowData = {};

        formRowSplit.forEach(function (val, index) {
          rowData[headers[index]] = val;
        });

        return rowData;
      })

    const formData = Object.groupBy(
      entries,
      function (formData) {
        return formData.Location;
      }
    );

    const entryCounts = Object.values(formData).map(function (item) { return item.length })

    const maxEntries = entryCounts.length > 0 && Math.max.apply(Math, entryCounts) || 1

    const tableDataHTML = entries.map(function (entry) {
      return `
        <tr data-county="${ entry["Location"] }">
          <td>${ entry["Date of the incident"] }</td>
          <td>${ entry["Location"] }</td>
          <td>${ formData[entry["Location"]].length }</td>
          <td>${ [entry["Law Enforcement Agencies"],  entry["Law Enforcement Agencies: Other"]].filter(function (item) { return item.length > 0}).join(', ') }</td>
          <td>${ entry["Did An Arrest Occur?"] }</td>
        </tr>
      `
    }).join('')

    document.querySelector('#incident-data tbody').innerHTML = tableDataHTML

    const incidentTable = new DataTable(
      '#incident-data',
      {
        paging: false,
        scrollCollapse: true,
        scrollY: '400px'
      }
    );

    counties.features = counties.features.map(function (feature) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          entries: formData[feature.properties.name] || [],
          entryCount: (formData[feature.properties.name] || []).length,
        },
      };
    });

    return {
      geojson: counties,
      meta: {
        maxEntries,
        minEntries: 0,
      }
    };
  }

  function highlightData(props) {
    const entries = document.querySelectorAll(`#incident-data tr[data-county="${props.name}"]`)

    Array.prototype.map.call(entries, function (entry) {
      entry.classList.add('selected')
    })

    if (entries && entries[0]) {      
      document.querySelector('.dt-scroll-body').scrollTo({
        top: entries[0].offsetTop,
        left: 0,
        behavior: "smooth",
      })
    }

  }
  function unhighlightData() {
    const entries = document.querySelectorAll(`#incident-data tr[data-county].selected`)

    Array.prototype.map.call(entries, function (entry) {
      entry.classList.remove('selected')
    })
  }

  function drawMap(mapInfo) {
    const data = mapInfo.geojson
    const meta = mapInfo.meta

    const backgroundColor = "#EAF2FA"
    const landColor = "#FFEDA0"
    const landStroke = "#800026"

    const mapEl = document.querySelector('#map')

    const chartWidth = mapEl.clientWidth
    const chartHeight = mapEl.clientHeight

    const scale = d3.scaleLinear([meta.minEntries, meta.maxEntries], [landColor, landStroke])

    const projection = d3.geoMercator()
      .scale([2000])
      .center([-99.9018, 31.4686])
      .translate([chartWidth / 2, chartHeight / 2]);

    const pathGenerator = d3.geoPath(projection);

    const svg = d3.create('svg')
      .attr("viewBox", [0, 0, chartWidth, chartHeight])
      .attr("title", "Map")
      .attr('width', chartWidth)
      .attr('height', chartHeight)

    svg.append("rect")
      .attr("class", "background")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr('fill', backgroundColor);

    svg.selectAll('g.counties path')
      .data(data.features.filter(d => d.geometry.type === "MultiPolygon"))
      .join('path')
        .attr('d', pathGenerator)
        .attr('fill', function (d) {
          return scale(d.properties.entryCount)
        })
        .attr('stroke', landStroke)
        .attr('stroke-width', 1)
      .on('mouseenter', function (mouseEvent, d) {
        highlightData(d.properties)
      })
      .on('mouseout', function (mouseEvent, d) {
        unhighlightData();
      });

    d3.select('#map')
      .node()
      .appendChild(svg.node())
  }

  Promise.all([
    fetch("./data/tx-counties.geojson"),
    // fetch("./data/filtered.tsv")
    fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQe6otdyhVEVKf744PAhGz9UNtQ1ELrfTHkyEUrQvkTEh37xsGIjLg7HU5q1Lpcpp4cqNvXpSL_2q4e/pub?output=tsv")
  ])
  .then(function (responses) {
    const counties = responses[0].json();
    const formData = responses[1].text();
    return [counties, formData];
  })
  .then(handleCountiesLoaded)
  .then(drawMap);

})();
