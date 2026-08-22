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

    // Dynamic configuration mapper for different image models
    const buildOptions = (targetModel: string) => {
      const options: any = {
        model: targetModel,
        prompt,
        n: 1,
        size: size as any,
      };

      if (targetModel.startsWith('gpt-image') || targetModel.startsWith('chatgpt-image')) {
        // gpt-image models support quality: 'low', 'medium', 'high', 'auto'. style is not supported.
        if (quality === 'hd') {
          options.quality = 'high';
        } else {
          options.quality = 'auto'; // default to auto for general usage
        }
      } else {
        // dall-e models support quality: 'standard', 'hd', style: 'vivid', 'natural'
        if (quality) {
          options.quality = quality as any;
        }
        if (style) {
          options.style = style as any;
        }
      }
      return options;
    };

    let response;
    let usedModel = 'gpt-image-2';

    try {
      console.log(`Attempting generation with primary model: ${usedModel}`);
      response = await openai.images.generate(buildOptions(usedModel));
    } catch (firstError: any) {
      console.warn(`Primary model ${usedModel} generation failed, checking fallback models...`, firstError?.message || firstError);
      const errText = String(firstError?.error?.message || firstError?.message || '').toLowerCase();

      // If the error indicates that the model 'gpt-image-2' does not exist or isn't accessible, try fallback models
      if (errText.includes('model') || errText.includes('not found') || errText.includes('access') || errText.includes('permission')) {
        try {
          usedModel = 'chatgpt-image-latest';
          console.log(`Fallback: Attempting generation with model: ${usedModel}`);
          response = await openai.images.generate(buildOptions(usedModel));
        } catch (secondError: any) {
          console.warn(`Fallback model ${usedModel} failed, trying DALL-E 3...`, secondError?.message || secondError);
          try {
            usedModel = 'dall-e-3';
            console.log(`Fallback: Attempting generation with model: ${usedModel}`);
            response = await openai.images.generate(buildOptions(usedModel));
          } catch (thirdError: any) {
            console.warn(`DALL-E 3 generation failed, checking DALL-E 2...`, thirdError?.message || thirdError);
            const thirdErrText = String(thirdError?.error?.message || thirdError?.message || '').toLowerCase();

            // Try DALL-E 2 as a final resort
            try {
              usedModel = 'dall-e-2';
              console.log(`Fallback: Attempting generation with final model: ${usedModel}`);
              // DALL-E 2 only supports square format, so reset size
              response = await openai.images.generate({
                model: 'dall-e-2',
                prompt,
                n: 1,
                size: '1024x1024',
              });
            } catch (finalError: any) {
              console.error('All image generation models failed.');
              throw finalError;
            }
          }
        }
      } else {
        // If it was some other error (e.g. safety block, invalid prompt, etc.), throw it
        throw firstError;
      }
    }

    const imageData = response?.data && response.data.length > 0 ? response.data[0] : null;
    let imageUrl = imageData?.url;
    const revisedPrompt = imageData?.revised_prompt;

    // Handle models that return base64 data instead of remote URLs
    if (!imageUrl && imageData?.b64_json) {
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: `Failed to generate image. No URL or base64 data returned from model '${usedModel}'.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl,
      revisedPrompt: revisedPrompt || `Generated using model: ${usedModel}`,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    
    const errorMessage = error?.error?.message || error?.message || 'An error occurred during image generation.';
    const status = error?.status || 500;

    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
