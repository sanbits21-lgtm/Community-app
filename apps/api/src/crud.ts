import { Router } from 'express';
import type { Model, SortOrder } from 'mongoose';
import type { ZodType } from 'zod';

interface CrudOptions {
  sort?: Record<string, SortOrder>;
}

/**
 * Admin CRUD for one model. The Zod schema is the only gate: whatever it strips never
 * reaches Mongo, so a request can't set fields (slug, timestamps) the admin UI doesn't own.
 * Updates are full replacements (PUT): the admin form always sends the whole document.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic over any Mongoose model
export function crud(model: Model<any>, schema: ZodType<any>, { sort = { createdAt: -1 } }: CrudOptions = {}): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await model.find().sort(sort).lean());
  });

  r.get('/:id', async (req, res) => {
    const doc = await model.findById(req.params.id).lean();
    if (!doc) return void res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  r.post('/', async (req, res) => {
    const data = schema.parse(req.body);
    res.status(201).json(await model.create(data));
  });

  r.put('/:id', async (req, res) => {
    const data = schema.parse(req.body);
    const doc = await model.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).lean();
    if (!doc) return void res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  r.delete('/:id', async (req, res) => {
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) return void res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  return r;
}
