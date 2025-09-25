import express from "express";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname)));

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// Initial canvas for image replacement input
const initialCanvas = {
  canvas: {
    content: {
      components: [
        {
          type: "text",
          id: "header",
          text: "🖼️ AI Image Replacer",
          align: "center",
          style: "header",
        },
        {
          type: "text",
          id: "description",
          text: "Replace images in articles using AI visual matching",
          align: "center",
          style: "muted",
        },
        {
          type: "input",
          id: "article_id",
          label: "Article ID",
          placeholder: "e.g., 4727254",
        },
        {
          type: "input",
          id: "old_image_url",
          label: "Image to Replace (URL)",
          placeholder: "https://example.com/old-image.png",
        },
        {
          type: "input",
          id: "new_image_url",
          label: "New Image URL",
          placeholder: "https://example.com/new-image.png",
        },
        {
          type: "button",
          label: "Find & Replace Images",
          style: "primary",
          id: "process_button",
          action: {
            type: "submit",
          },
        },
      ],
    },
  },
};

// Processing canvas shown during AI analysis
const processingCanvas = {
  canvas: {
    content: {
      components: [
        {
          type: "text",
          id: "processing",
          text: "🤖 AI Processing...",
          align: "center",
          style: "header",
        },
        {
          type: "text",
          id: "status",
          text: "Loading article and analyzing images...",
          align: "center",
          style: "muted",
        },
      ],
    },
  },
};

app.get("/", (response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.post("/initialize", (request, response) => {
  response.send(initialCanvas);
});

app.post("/submit", async (request, response) => {
  if (request.body.component_id === "process_button") {
    const { article_id, old_image_url, new_image_url } = request.body.input_values;
    
    // Validate inputs
    if (!article_id || !old_image_url || !new_image_url) {
      const errorCanvas = {
        canvas: {
          content: {
            components: [
              {
                type: "text",
                id: "error",
                text: "❌ Error",
                align: "center",
                style: "header",
              },
              {
                type: "text",
                id: "error_message",
                text: "Please fill in all required fields",
                align: "center",
                style: "muted",
              },
              {
                type: "button",
                label: "Try Again",
                style: "secondary",
                id: "restart_button",
                action: {
                  type: "submit",
                },
              },
            ],
          },
        },
      };
      return response.send(errorCanvas);
    }

    try {
      // Start the image replacement process
      const result = await processImageReplacement(article_id, old_image_url, new_image_url);
      
      const successCanvas = {
        canvas: {
          content: {
            components: [
              {
                type: "text",
                id: "success",
                text: result.success ? "✅ Success!" : "⚠️ Completed",
                align: "center",
                style: "header",
              },
              {
                type: "text",
                id: "result_message",
                text: result.message,
                align: "center",
                style: "muted",
              },
              {
                type: "text",
                id: "details",
                text: `Images found: ${result.imagesFound || 0} | Matches: ${result.matchesFound || 0} | Replaced: ${result.replacements || 0}`,
                align: "center",
                style: "muted",
              },
              {
                type: "button",
                label: "Replace More Images",
                style: "primary",
                id: "restart_button",
                action: {
                  type: "submit",
                },
              },
            ],
          },
        },
      };
      
      response.send(successCanvas);
    } catch (error) {
      console.error('Image replacement error:', error);
      
      const errorCanvas = {
        canvas: {
          content: {
            components: [
              {
                type: "text",
                id: "error",
                text: "❌ Error",
                align: "center",
                style: "header",
              },
              {
                type: "text",
                id: "error_message",
                text: error.message || "An unexpected error occurred",
                align: "center",
                style: "muted",
              },
              {
                type: "button",
                label: "Try Again",
                style: "secondary",
                id: "restart_button",
                action: {
                  type: "submit",
                },
              },
            ],
          },
        },
      };
      
      response.send(errorCanvas);
    }
  } else {
    // Restart button clicked
    response.send(initialCanvas);
  }
});

// Main image replacement logic
async function processImageReplacement(articleId, oldImageUrl, newImageUrl) {
  console.log(`Processing image replacement for article ${articleId}`);
  
  try {
    // Step 1: Fetch article from Intercom
    const article = await fetchIntercomArticle(articleId);
    if (!article) {
      throw new Error('Article not found');
    }
    
    // Step 2: Extract all image URLs from article HTML
    const imageUrls = extractImageUrls(article.body);
    console.log(`Found ${imageUrls.length} images in article`);
    
    if (imageUrls.length === 0) {
      return {
        success: false,
        message: 'No images found in the article',
        imagesFound: 0,
        matchesFound: 0,
        replacements: 0
      };
    }
    
    // Step 3: Load the reference image (to be replaced)
    const referenceImageData = await loadImageAsBase64(oldImageUrl);
    
    // Step 4: Compare reference image with each article image using AI
    const matches = [];
    for (const imageUrl of imageUrls) {
      try {
        const articleImageData = await loadImageAsBase64(imageUrl);
        const isMatch = await compareImagesWithAI(referenceImageData, articleImageData, oldImageUrl, imageUrl);
        
        if (isMatch) {
          matches.push(imageUrl);
          console.log(`Match found: ${imageUrl}`);
        }
      } catch (error) {
        console.warn(`Failed to process image ${imageUrl}:`, error.message);
      }
    }
    
    console.log(`Found ${matches.length} matching images`);
    
    if (matches.length === 0) {
      return {
        success: false,
        message: 'No matching images found in the article',
        imagesFound: imageUrls.length,
        matchesFound: 0,
        replacements: 0
      };
    }
    
    // Step 5: Replace matching image URLs with new URL
    let updatedBody = article.body;
    let replacementCount = 0;
    
    matches.forEach(matchUrl => {
      const regex = new RegExp(escapeRegExp(matchUrl), 'g');
      const occurrences = (updatedBody.match(regex) || []).length;
      updatedBody = updatedBody.replace(regex, newImageUrl);
      replacementCount += occurrences;
    });
    
    // Step 6: Update article in Intercom
    await updateIntercomArticle(articleId, updatedBody);
    
    return {
      success: true,
      message: `Successfully replaced ${replacementCount} image occurrences`,
      imagesFound: imageUrls.length,
      matchesFound: matches.length,
      replacements: replacementCount
    };
    
  } catch (error) {
    console.error('Error in processImageReplacement:', error);
    throw error;
  }
}

// Fetch article from Intercom API
async function fetchIntercomArticle(articleId) {
  const response = await fetch(`https://api.intercom.io/articles/${articleId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
      'Accept': 'application/json',
      'Intercom-Version': '2.11'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.statusText}`);
  }
  
  return await response.json();
}

// Update article in Intercom
async function updateIntercomArticle(articleId, newBody) {
  const response = await fetch(`https://api.intercom.io/articles/${articleId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Intercom-Version': '2.11'
    },
    body: JSON.stringify({
      body: newBody
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update article: ${response.statusText}`);
  }
  
  return await response.json();
}

// Extract image URLs from HTML
function extractImageUrls(html) {
  const imageRegex = /<img[^>]+src="([^"]+)"/gi;
  const urls = [];
  let match;
  
  while ((match = imageRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

// Load image and convert to base64
async function loadImageAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  
  return {
    base64,
    contentType,
    url
  };
}

// Compare two images using AI
async function compareImagesWithAI(image1, image2, url1, url2) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two images and determine if they are the same image or substantially similar (considering they might be different sizes, formats, or compression levels). Respond with ONLY 'true' if they match or 'false' if they don't match. No other text."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image1.contentType,
                  data: image1.base64
                }
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image2.contentType,
                  data: image2.base64
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const result = data.content[0].text.trim().toLowerCase();
    
    console.log(`AI comparison result for ${url1} vs ${url2}: ${result}`);
    return result === 'true';
    
  } catch (error) {
    console.error('AI comparison error:', error);
    return false;
  }
}

// Utility function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
