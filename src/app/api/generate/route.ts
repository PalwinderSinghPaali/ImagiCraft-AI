import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing on the server. Please configure OPENAI_API_KEY in your .env.local file.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    let response;
    try {
      const apiOptions: any = {
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: size as any,
      };

      // Only include optional parameters if they are supported by the gateway/version
      if (quality) {
        apiOptions.quality = quality as any;
      }
      if (style) {
        apiOptions.style = style as any;
      }

      response = await openai.images.generate(apiOptions);
    } catch (firstError: any) {
      console.warn('Initial DALL-E 3 generation failed, attempting parameter fallback...', firstError?.message || firstError);
      
      const errText = String(firstError?.error?.message || firstError?.message || '').toLowerCase();
      
      // If error is related to parameters like style or quality, retry without them
      if (errText.includes('style') || errText.includes('quality') || errText.includes('parameter') || errText.includes('unknown')) {
        try {
          response = await openai.images.generate({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: size as any,
          });
        } catch (secondError: any) {
          console.warn('Fallback DALL-E 3 generation failed, checking for DALL-E 2 fallback...', secondError?.message || secondError);
          const secondErrText = String(secondError?.error?.message || secondError?.message || '').toLowerCase();
          
          if (secondErrText.includes('model') || secondErrText.includes('not found') || secondErrText.includes('access') || secondErrText.includes('permission')) {
            // Fallback to DALL-E 2
            response = await openai.images.generate({
              model: 'dall-e-2',
              prompt,
              n: 1,
              size: '1024x1024',
            });
          } else {
            throw secondError;
          }
        }
      } else if (errText.includes('model') || errText.includes('not found') || errText.includes('access') || errText.includes('permission')) {
        // Fallback to DALL-E 2 directly
        response = await openai.images.generate({
          model: 'dall-e-2',
          prompt,
          n: 1,
          size: '1024x1024',
        });
      } else {
        throw firstError;
      }
    }

    const imageData = response?.data && response.data.length > 0 ? response.data[0] : null;
    const imageUrl = imageData?.url;
    const revisedPrompt = imageData?.revised_prompt;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Failed to generate image. No URL returned from OpenAI.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl,
      revisedPrompt,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    
    // Attempt to extract structured error message from OpenAI SDK error
    const errorMessage = error?.error?.message || error?.message || 'An error occurred during image generation.';
    const status = error?.status || 500;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
