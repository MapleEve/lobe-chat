import { AgentRuntimeErrorType } from '@lobechat/model-runtime';
import { getUserAuth } from '@lobechat/utils/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createCallerFactory } from '@/libs/trpc/lambda';
import { lambdaRouter } from '@/server/routers/lambda';
import { createErrorResponse } from '@/utils/errorResponse';

const createCaller = createCallerFactory(lambdaRouter);

// Input validation schema matching RuntimeImageGenParams
const CreateImageRequestSchema = z.object({
  model: z.string(),
  params: z.object({
    
    // Optional standard parameters
aspectRatio: z.string().optional(),
    
    
cfg: z.number().optional(),
    
height: z.number().optional(),
    
imageUrl: z.string().nullable().optional(),
    
imageUrls: z.array(z.string()).optional(),
    // Required parameter
prompt: z.string(),
    samplerName: z.string().optional(),
    scheduler: z.string().optional(),
    seed: z.number().nullable().optional(),
    size: z.string().optional(),
    steps: z.number().optional(),
    strength: z.number().optional(),
    width: z.number().optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await getUserAuth();
    if (!userId) {
      return createErrorResponse(AgentRuntimeErrorType.InvalidProviderAPIKey, 401);
    }

    // Parse and validate request body
    const body = await req.json();
    const { model, params } = CreateImageRequestSchema.parse(body);

    // Create tRPC caller with user context
    const caller = createCaller({ userId });

    // Get ComfyUI options from request headers
    const authHeader = req.headers.get('authorization');
    const comfyUIBaseURL = req.headers.get('x-comfyui-baseurl');

    const options = {
      ...(authHeader && { apiKey: authHeader.replace('Bearer ', '') }),
      ...(comfyUIBaseURL && { baseURL: comfyUIBaseURL }),
    };

    // Call ComfyUI service through tRPC
    const result = await caller.comfyui.createImage({
      model,
      options,
      params,
    });

    return Response.json(result);
  } catch (error) {
    console.error('ComfyUI createImage API error:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse(AgentRuntimeErrorType.InvalidProviderAPIKey, 400);
    }

    return createErrorResponse(AgentRuntimeErrorType.AgentRuntimeError, 500);
  }
}
