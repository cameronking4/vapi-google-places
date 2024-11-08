// app/api/vapi/nearby-vets/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface ClinicInfo {
    name: string;
    address: string;
    rating?: number;
    userRatingsTotal?: number;
    phoneNumber?: string;
  }
  
  interface ClinicsResponse {
    clinics: ClinicInfo[];
  }
  
  interface ErrorResponse {
    error: string;
  }

const apiKey = process.env.GOOGLE_API_KEY;

const endpoint = `https://places.googleapis.com/v1/places:searchText`;
const defaultRadius = 8046.72; // default to 5 miles in meters

// Google Places Text Search API function to fetch pet clinics
const fetchPetClinics = async (zipCode: string) => {
    const textQuery = `Emergency vet / pet clinic open now ${zipCode}`;
    if (!apiKey) {
        const errorResponse: ErrorResponse = { error: 'Google API key is required. Please specify apiKey parameter.' };
        return NextResponse.json(errorResponse, { status: 400 });
    }
    try {
        const requestBody = {
            textQuery: textQuery,
            openNow: true,
            locationBias: {
                circle: {
                    radius: defaultRadius,
                }
            }
        };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.internationalPhoneNumber',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorResponse: ErrorResponse = { error: 'Failed to fetch vet clinics' };
            return NextResponse.json(errorResponse, { status: response.status });
        }
        const data = await response.json();
        const places = data.places || [];
        const clinicInfo: ClinicInfo[] = places.map((place: { displayName: { text: string }, formattedAddress: string, rating?: number, userRatingCount?: number, internationalPhoneNumber?: string }) => ({
            name: place.displayName.text,
            address: place.formattedAddress,
            rating: place.rating,
            userRatingsTotal: place.userRatingCount,
            phoneNumber: place.internationalPhoneNumber,
        }));
        const clinicsResponse: ClinicsResponse = { clinics: clinicInfo };
        console.log(clinicsResponse);
        return NextResponse.json(clinicsResponse);
    } catch (error) {
        const errorResponse: ErrorResponse = { error: 'Server error: ' + JSON.stringify(error) };
        return NextResponse.json(errorResponse, { status: 500 });
     }    
};

// Parent function to search for nearby open clinics
async function searchOpenClinics({ zipCode }: { zipCode: string; }) {
  const clinics = await fetchPetClinics(zipCode);
  console.log(clinics);
  return clinics;
}

// API endpoint for Vapi to get nearby open clinics
export async function POST(request: NextRequest) {

  try {
    // Parse the request body only once
    const body = await request.json();
    console.log(JSON.stringify(body, null, 2));
    const toolCallId = body.message.toolCalls[0].id;
    console.log(toolCallId);
    let parameters = body.message.toolCalls[0].function.arguments;
    // If parameters is a string, parse it as JSON
    if (typeof parameters === 'string') {
      parameters = JSON.parse(parameters);
    }
    // Validate zipCode in parameters
    if (!parameters || typeof parameters.zipCode !== 'string') {
      return NextResponse.json(
        { message: 'Invalid or missing parameters: zipCode is required.'},
        { status: 400 }
      );
    }
    // Extract zipCode from parameters passed by Vapi using getPetClinics tool
    const zipCode = parameters.zipCode;
    console.log(zipCode);
    // Call function above to get nearby open clinics
    const clinics = await searchOpenClinics(zipCode);
    console.log(clinics);
    // Format response to be returned to Vapi (exact format as specified in Vapi Documentation)
    const response = {
      results: [
        {
          toolCallId: toolCallId,
          result: {
            message: "Nearby open clinics found successfully. " + JSON.stringify(clinics),
          },
        },
      ],
    };
    // Return response to Vapi
    const jsonResponse = NextResponse.json(response, { status: 200 });
    // Allow requests from any origin - Do Not Remove
    jsonResponse.headers.set('Access-Control-Allow-Origin', '*');
    jsonResponse.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    jsonResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    console.log(jsonResponse);
    return jsonResponse;
  } catch (error) {
    console.error('Error processing request:', error);
    const jsonResponse = NextResponse.json({ message: 'Server error: ' + JSON.stringify(error) }, { status: 500 });
    jsonResponse.headers.set('Access-Control-Allow-Origin', '*');
    jsonResponse.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    jsonResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return jsonResponse;
  }
}

export async function OPTIONS() {
  const response = NextResponse.json({}, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}
