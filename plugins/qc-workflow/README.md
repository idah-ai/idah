# QC Workflow Plugin

This plugin provides a workflow that integrates an automatic external QC (Quality Control) step between annotation and review.

## Flow

```
User annotates → submits → IDAH sends data to external QC app → entry goes to "qc" step
  → QC app processes → calls back to IDAH → annotations updated + notes created → entry advances to "review"
  → Reviewer approves or requests changes
```

## States

| State | Description |
|---|---|
| `start` | Entry is ready for annotation |
| `annotate` | Annotator works on the entry |
| `qc` | External QC in progress — entry is read-only until callback |
| `review` | Reviewer inspects the annotation and QC result |
| `done` | Workflow completed |
| `error` | An error occurred |

## Events

| Event | Triggered by | Transitions |
|---|---|---|
| `submit` | User (frontend) | `start → annotate`, `annotate → qc`, `review → done/annotate` |
| `resolve_external` | External app (via `POST /entries/:id/workflow_callback`) | `qc → review` |
| `error` | User (frontend) | Any active step → `error` |

## Configuration

When creating a dataset with `workflow_name: "qc-annotation-workflow"`, set the following in `workflow_configuration`:

```json
{
  "workflow_configuration": {
    "qc": {
      "endpoint": "https://qc-app.example.com/annotations",
      "callback_token": "your-shared-secret"
    }
  }
}
```

- `endpoint` — The URL of the external QC app that receives annotation data
- `callback_token` — Shared secret used to authenticate the callback from the external app

## Outbound Payload

When the annotator submits (`annotate → qc`), IDAH POSTs to the configured `endpoint`:

```json
{
  "entry_id": "uuid",
  "entry_name": "entry-001.jpg",
  "qc_callback_url": "https://idah.local/api/v1/entries/<uuid>/workflow_callback",
  "callback_token": "your-shared-secret",
  "annotations": [
    {
      "id": "annotation-uuid",
      "dimensions": { "type": "rectangle", "x": 100, "y": 200, "width": 50, "height": 50 },
      "annotation": { "label": "cat", "confidence": 0.95 },
      "metadata": {}
    }
  ]
}
```

## Callback Payload

The external app calls back to `POST /entries/:id/workflow_callback`:

```json
{
  "data": {
    "attributes": {
      "token": "your-shared-secret",
      "annotations": [
        {
          "id": "annotation-uuid",
          "annotation": { "label": "cat", "confidence": 0.95 },
          "dimensions": { "type": "rectangle", "x": 10, "y": 20, "width": 100, "height": 100 },
          "metadata": { "qc_score": 0.98, "qc_checked": true }
        }
      ],
      "notes": [
        {
          "body": "QC check passed. Score: 0.98",
          "annotation_id": null,
          "anchor_type": "qc",
          "position": null
        }
      ]
    }
  }
}
```

## Developing a Custom External QC App

1. Receive the POST from IDAH with annotations
2. Process the annotations (run your model, manual check, etc.)
3. POST results back to the `qc_callback_url` with:
   - `token` for authentication
   - `annotations` — any updates to existing annotations (or empty if no changes)
   - `notes` — any notes/feedback to show in the IDAH UI (or empty)
4. IDAH applies the updates and advances the workflow to `review`

## Testing

```bash
# 1. Place the plugin in the plugins/ directory
# 2. Create a dataset with workflow_name: "qc-annotation-workflow"
# 3. Set workflow_configuration.qc.endpoint and workflow_configuration.qc.callback_token
# 4. Add an entry and annotate it
# 5. Submit → entry goes to "qc" step
# 6. External app receives data
# 7. External app POSTs to workflow_callback → entry goes to "review"