import { NextResponse } from "next/server";
import { loadCompanyDNA } from "@/lib/company/load-company-dna";

/**
 * JSON API for CompanyDNA. UI and future clients share this contract;
 * connectors remain behind the Insight Engine.
 */
export async function GET() {
  const dna = await loadCompanyDNA();
  return NextResponse.json(dna);
}
