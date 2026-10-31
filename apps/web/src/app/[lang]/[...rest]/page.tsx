import { notFound } from "next/navigation";

/** Cualquier ruta desconocida bajo /[lang] muestra nuestro not-found traducido. */
export default function CatchAll() {
  notFound();
}
