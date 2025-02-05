import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import L from "leaflet";
import { useMap } from "react-leaflet";

import axios from 'axios';          // part 1
import { useTracker } from '../hooks';    // part 2
import { commafy, friendlyDate } from 'lib/util';    // part 2
import Layout from "components/Layout";
import Container from "components/Container";
import Map from "components/Map";
import Snippet from "components/Snippet";
import { CasesWrapper } from '../components/CurrentCasesMap';
import { Select } from '../components/Select';
import Authors from "../components/authors/Authors";
import { Button } from "@mui/material";
import { CasesTables } from "../components/CasesTables";

const LOCATION = {
  lat: 34.0522,
  lng: -118.2437,
};
const CENTER = [LOCATION.lat, LOCATION.lng];
const DEFAULT_ZOOM = 2;

const IndexPageContent = ({ country, refresh, ...props }) => {
  const { data: countries = [] } = useTracker({
    api: 'countries',
    refresh: refresh
  });
  const hasCountries = Array.isArray(countries) && countries.length > 0;
  console.log('@WILL -- warning: countries is null');
  if (countries) {
    console.log('@WILL -- countries.length is: ', countries.length);
  }
  const { data: stats = {} } = useTracker({ api: 'all', refresh: refresh });

  const dashboardStats = [
    {
      primary: { label: 'Total Cases', value: commafy(stats?.cases) },
      secondary: { label: 'Per 1 Million', value: commafy(stats?.casesPerOneMillion) }
    },
    {
      primary: { label: 'Total Deaths', value: commafy(stats?.deaths) },
      secondary: { label: 'Per 1 Million', value: commafy(stats?.deathsPerOneMillion) }
    },
    {
      primary: { label: 'Total Tests', value: commafy(stats?.tests) },
      secondary: { label: 'Per 1 Million', value: commafy(stats?.testsPerOneMillion) }
    }
  ];
  async function mapEffect(map) {
    // if (!hasCountries) { 
    //   console.log('@WILL: returning -- hasCountries is false');
    //   return; 
    // }    // part 2
    let response;            // part 1
    console.log('MapEffect automatically called, calling axios.get()');
    try {
      response = await axios.get(`https://disease.sh/v3/covid-19/countries`);
    } catch (e) {
      console.log('Failed to fetch countries: ${e.message}', e);
      return;
    }
    // const { countries = [] } = response;  // part 2
    // console.log(countries);
    const { data = [] } = response;   // part 1
    console.log(data);
    // const hasData = Array.isArray(countries) && countries.length > 0;  // part 2
    // if ( !hasData ) return;
    const hasData = Array.isArray(data) && data.length > 0;  // part 1
    if (!hasData) return;
    const geoJson = {
      type: 'FeatureCollection',
      // features: countries.map((country = {}) => {    // part 2
      features: data.filter(item => !!country && country !== 'All Countries' ? item.country === country : item).map((country = {}) => {      // part 1
        const { countryInfo = {} } = country;
        const { lat, long: lng } = countryInfo;
        return {
          type: 'Feature',
          properties: {
            ...country,
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        }
      })
    }

    const geoJsonLayers = new L.GeoJSON(geoJson, {
      pointToLayer: (feature = {}, latlng) => {
        const { properties = {} } = feature;
        let updatedFormatted;
        let casesString;

        const {
          country,
          updated,
          cases,
          deaths,
          recovered
        } = properties

        casesString = `${cases}`;

        if (cases > 1000) {
          casesString = `${casesString.slice(0, -3)}k+`
        }

        if (updated) {
          updatedFormatted = new Date(updated).toLocaleString();
        }

        const html = `
          <span class="icon-marker">
            <span class="icon-marker-tooltip">
              <h2>${country}</h2>
              <ul>
                <li><strong>Confirmed:</strong> ${cases}</li>
                <li><strong>Deaths:</strong> ${deaths}</li>
                <li><strong>Recovered:</strong> ${recovered}</li>
                <li><strong>Last Update:</strong> ${updatedFormatted}</li>
              </ul>
            </span>
            ${casesString}
          </span>
        `;

        return L.marker(latlng, {
          icon: L.divIcon({
            className: 'icon',
            html
          }),
          riseOnHover: true
        });
      }
    });
    console.log('@WILL -- about to complete geoJson');
    console.log(geoJson);
    geoJsonLayers.addTo(map);
  };
  const mapSettings = {
    center: CENTER,
    defaultBaseMap: "OpenStreetMap",
    zoom: DEFAULT_ZOOM,
    whenCreated: mapEffect,
  };

  const map = React.useMemo(() => <Map {...mapSettings} />, [country]);
  return (
    <Layout pageName="home">
      <Helmet>
        <title>Home Page</title>
      </Helmet>


      <div key={country} className="tracker">
        {props.children}
        {map}
        <div className="tracker-stats">
          <ul>
            {dashboardStats.map(({ primary = {}, secondary = {} }, i) => {
              return (
                <li key={`Stat-${i}`} className="tracker-stat">
                  {primary.value && (
                    <p className="tracker-stat-primary">
                      {primary.value}
                      <strong> {primary.label} </strong>
                    </p>
                  )}
                  {/* { secondary.value && (
                <p className="tracker-stat-secondary">
                  { secondary.value } 
                  <strong> { secondary.label } </strong>
                </p>
              ) } */}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="tracker-last-updated">
        <p>Last Updated: {stats ? friendlyDate(stats?.updated) : '-'} </p>
      </div>
      <CasesWrapper country={country} refresh={refresh} />
      <CasesTables country={country} />
    </Layout>
  );
};

const IndexPage = () => {
  const [selectedCountry30Days, setSelectedCountry30Days] = React.useState();
  const [refresh, setRefresh] = React.useState(false)
  const [countryList, setCountryList] = React.useState([])
  React.useEffect(() => {
    axios.get('https://disease.sh/v3/covid-19/countries').then(response => {
      setCountryList(response.data.map(item => item.country));
    })
  }, [])

  const onChange = event => {
    setSelectedCountry30Days(event.target.value);
  }

  React.useEffect(() => {
    const interval = setInterval(() => {
      setRefresh(prev => !prev);
    }, 1000 * 60 * 60)
    return () => clearInterval(interval);
  }, [])

  const page = React.useMemo(() => <IndexPageContent country={selectedCountry30Days} refresh={refresh}>
    <Select data={countryList} onChange={onChange} value={selectedCountry30Days} />
  </IndexPageContent>, [selectedCountry30Days, countryList, refresh])

  return <React.Fragment>
    {page}
    
    <Authors />
  </React.Fragment>;
}
export default IndexPage;