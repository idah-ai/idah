import type { ActivityContext } from './ActivityContext';

/**
 * Example of how to define an ActivityContext with annotation tools
 */
const exampleActivityContext: ActivityContext = {
  mode: 'edit',

  medias: {
    'main': {
      url: 'https://example.com/image.jpg',
      metadata: {
        width: 1920,
        height: 1080,
        mimeType: 'image/jpeg'
      }
    }
  },

  // Define the allowed annotation tools
  tools: {

    // Bounding box annotation type
    'bounding_box': {
      // Optional shape-specific configuration
      shapeConfig: {
        minWidth: 10,
        minHeight: 10,
        strokeColor: '#FF0000'
      },

      // Define which value fields are allowed for bounding boxes
      allowedFields: {
        // Allow specific categories and subcategories
        categories: {
          "object": [
            {
              name: 'vehicles',
              nestedCategories: [
                {name: 'car'},
                {name: 'truck'},
                {name: 'motorcycle'},
              ]
            },
            {
              name: 'pedestrians',
              nestedCategories: [
                {name: 'adult'},
                {name: 'child'}
              ]
            },
            {
              name: 'traffic_signs',
              nestedCategories: [
                {name: 'stop'},
                {name: 'yield'},
                {name: 'speed_limit'}
              ]
            }
          ]
        },
        // Allow labels
        label: true,
        // Don't allow text
        text: false,
        // Allow confidence values
        confidence: true,
        // Allow specific tags only
        tags: ['verified', 'uncertain', 'review_needed'],
        // Allow specific attribute keys
        attributes: ['color', 'occlusion', 'truncation', 'pose']
      },

      // Define which fields are required
      requiredFields: ['categories.object']
    },

    // Polygon annotation type
    'polygon': {
      shapeConfig: {
        minPoints: 3,
        maxPoints: 100,
        strokeColor: '#00FF00',
        fillColor: 'rgba(12, 224, 47, 0.7)'
      },

      allowedFields: {
        // Allow labels
        label: true,
        // Allow text
        text: true,
        // Show confidence
        confidence: true,
        // Allow any tags
        tags: true,
        // Allow any attributes
        attributes: true
      },

      // Tags only is required
      requiredFields: ['tags']
    },

    // Text classification annotation type
    'text_classification': {
      allowedFields: {
        // Allow specific categories
        categories: {
          'sentiment': [{name: 'positive'}, {name: 'neutral'}, {name: 'negative'}],
          'intent': [{name: 'question'}, {name: 'statement'}, {name: 'command'}]
        },
        // Allow text
        text: true,
        // Don't allow tags
        tags: false,
        // Don't allow attributes
        attributes: false
      },

      // Require category and text
      requiredFields: ['categories.sentiment', 'text']
    },

    // Point annotation type
    'point': {
      shapeConfig: {
        radius: 5,
        color: '#0000FF'
      },

      allowedFields: {
        // Allow specific categories
        categories: {
          'type': [
            {
              name: 'landmarks',
              requiredNested: true,
              nestedCategories: [{name: 'eye'}, {name: 'nose'}, {name: 'mouth'}, {name: 'ear'}],
            },
            {
              name: 'keypoints',
              requiredNested: true,
              nestedCategories: [{name: 'joint'}, {name: 'endpoint'}]
            }
          ]
        },
        // Don't allow text
        text: false,
      },

      // Require category
      requiredFields: ['categories.type']
    },

    // Whole image classification annotation type
    'image_classification': {
      // No shape config needed as it applies to the whole image

      allowedFields: {
        // Allow specific categories
        categories: {
          'image_type': [
            {
              name: 'scene',
              requiredNested: true,
              nestedCategories: [
                {name: 'indoor'},
                {name: 'outdoor'},
                {name: 'urban'},
                {name: 'rural'},
                {name: 'natural'}
              ]
            },
            {
              name: 'content',
              nestedCategories: [
                {name: 'people'},
                {name: 'animals'},
                {name: 'vehicles'},
                {name: 'buildings'},
                {name: 'landscape'}
              ]
            },
            {
              name: 'quality',
              nestedCategories: [
                {name: 'good'},
                {name: 'average'},
                {name: 'poor'}
              ]
            }
          ],
          'nsfw_detection': [
            {name: 'safe'},
            {name: 'questionable'},
            {name: 'explicit'}
          ]
        },
        // Allow text for additional description
        text: true,
        // Allow confidence values
        confidence: true,
        // Allow tags
        tags: ['reviewed', 'needs_review', 'flagged'],
        // Allow attributes for additional metadata
        attributes: ['lighting', 'composition', 'focus', 'exposure']
      },

      // Require at least one category
      requiredFields: ['categories.image_type']
    }
  }
};

export default exampleActivityContext;
