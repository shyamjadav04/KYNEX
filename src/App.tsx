import { useCallback } from "react";
import "./ui/kynex.css";
import { bootKynex } from "./game/bootstrap";
import KynexUI from "./ui/KynexUI";

export default function App() {
  const startGame = useCallback(() => bootKynex(), []);
  return <KynexUI boot={startGame} />;
}
