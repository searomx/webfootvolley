import { submissionSchema } from "@/lib/registration";
import { registerAthlete } from "@/lib/server/registrations";
import { HttpError, errorResponse, limitRequests, readJson } from "@/lib/server/http";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const parsed = submissionSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "Revise os campos do formulário e as categorias selecionadas.");
    await limitRequests(request, "registrations", 30);
    const result = await registerAthlete(parsed.data.requestId, parsed.data.athlete);
    return Response.json(result, {
      status: result.emailStatus === "SENT" ? 200 : 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "registrations");
  }
}
