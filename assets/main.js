(function () {
  async function handleCountiesLoaded(data) {
    const [countiesPromise, formDataPromise] = data;
    const counties = await countiesPromise;
    const formTXT = await formDataPromise;

    const [headerRow, ...formRows] = formTXT.split("\n");

    const headers = headerRow.split(",");
    const entries = formRows
      .map(function (formRow) {
        return formRow.split(",");
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

    const tableDataHTML = entries.map(function (entry) {
      return `
        <tr data-county="${ entry["Location"] }">
          <td>${ entry["Date of the incident"] }</td>
          <td>${ entry["Location"] }</td>
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

    return counties;
  }
  function highlightData(props) {
    const entries = document.querySelectorAll(`#incident-data tr[data-county="${props.name}"]`)

    Array.prototype.map.call(entries, function (entry) {
      entry.classList.add('selected')
    })

    if (entries && entries[0]) {
      console.log(entries[0])
      
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
  const map = L.map("map").setView([31.9686, -99.9018], 6);

  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 14,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // control that shows state info on hover
  const info = L.control();

  info.onAdd = function (map) {
    this._div = L.DomUtil.create("div", "info");
    this.update();
    return this._div;
  };

  info.update = function (props) {
    const contents = props
      ? `<b>${props.entryCount}</b>`
      : "Hover over a county";
    this._div.innerHTML = `<h4>Number of incidents</h4>${contents}`;
  };

  info.addTo(map);

  // get color depending on population density value
  function getColor(d) {
    return d > 5
      ? "#800026"
      : d > 3
      ? "#FC4E2A"
      : d > 0
      ? "#FD8D3C"
      : "#FFEDA0";
  }

  function style(feature) {
    return {
      weight: 2,
      opacity: 1,
      color: "white",
      dashArray: "1",
      fillOpacity: 0.7,
      fillColor: getColor(feature.properties.entryCount),
    };
  }

  function highlightFeature(e) {
    const layer = e.target;

    layer.setStyle({
      weight: 2,
      color: "#666",
      dashArray: "",
      fillOpacity: 0.7,
    });

    layer.bringToFront();

    info.update(layer.feature.properties);

    highlightData(layer.feature.properties);
  }

  Promise.all([fetch("./data/tx-counties.geojson"), fetch("./data/filtered.csv")])
    .then(function (responses) {
      const counties = responses[0].json();
      const formData = responses[1].text();
      return [counties, formData];
    })
    .then(handleCountiesLoaded)
    .then(function (countiesGeo) {
      window.geojson = L.geoJson(countiesGeo, {
        style,
        onEachFeature,
      }).addTo(map);
    });

  /* global statesData */

  function resetHighlight(e) {
    geojson.resetStyle(e.target);
    info.update();

    unhighlightData();
  }

  function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: zoomToFeature,
    });
  }

  // map.attributionControl.addAttribution('Population data &copy; <a href="http://census.gov/">US Census Bureau</a>');

  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create("div", "info legend");
    // const grades = [0, 10, 20, 50, 100, 200, 500, 1000];
    const grades = [0, 3, 5];
    const labels = [];
    let from, to;

    for (let i = 0; i < grades.length; i++) {
      from = grades[i];
      to = grades[i + 1];

      labels.push(
        `<i style="background:${getColor(from + 1)}"></i> ${from}${
          to ? `&ndash;${to}` : "+"
        }`
      );
    }

    div.innerHTML = labels.join("<br>");
    return div;
  };

  legend.addTo(map);
})();
