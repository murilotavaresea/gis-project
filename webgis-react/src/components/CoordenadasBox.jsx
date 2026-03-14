import React, { useState } from "react";
import { useMapEvents } from "react-leaflet";

export default function CoordenadasBox() {
  const [coords, setCoords] = useState(null);

  useMapEvents({
    mousemove(e) {
      setCoords(e.latlng);
    },
  });

  return (
    <div className="coords-card">
      {coords ? (
        <div>
          <strong>DEC</strong>: Lat {coords.lat.toFixed(6)}, Lng {coords.lng.toFixed(6)}
        </div>
      ) : (
        <div>Movimente o cursor no mapa</div>
      )}
    </div>
  );
}
