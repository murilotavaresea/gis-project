import React from "react";
import { useMap } from "react-leaflet";

const MAP_CENTER = [-14.8, -51.5];
const MAP_ZOOM = 5;

export default function BotaoRecentrar() {
  const map = useMap();

  const handleClick = () => {
    if (map) {
      map.setView(MAP_CENTER, MAP_ZOOM);
    }
  };

  return (
    <button className="map-recenterButton" onClick={handleClick} type="button">
      <img src="/icons/centralizar.png" alt="Recentralizar" />
      <span>Recentralizar</span>
    </button>
  );
}
