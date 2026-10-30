import type { APIRoute, GetStaticPaths } from "astro";
import { ogSvg, renderPng } from "../../lib/og";
import { typeCodes } from "../../lib/scoring";

export const getStaticPaths: GetStaticPaths = () => typeCodes().map((code) => ({ params: { code } }));

export const GET: APIRoute = ({ params }) =>
  new Response(new Uint8Array(renderPng(ogSvg(params.code!))), {
    headers: { "Content-Type": "image/png" },
  });
