import { useState } from "react";
import "./App.css";
import {
  MapLibreMap,
  Sidebar,
  TopToolbar,
} from "@mapcomponents/react-maplibre";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import LayerTree from "./components/LayerTree";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <>
      <MapLibreMap
        options={{
          style: "https://wms.wheregroup.com/tileserver/style/osm-bright.json",
          zoom: 19,
          center: [9.9347680519611, 51.531935000614226],
        }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />
      <TopToolbar
        buttons={
          <IconButton
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="toggle sidebar"
          >
            <MenuIcon />
          </IconButton>
        }
      />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <LayerTree />
      </Sidebar>
    </>
  );
}

export default App;
