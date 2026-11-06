import test from "node:test";
import assert from "node:assert/strict";
import { makePlace, makeArtwork } from "../src/domain/models.ts";
import {
  COLLECTIONS, filterIncludes, editorialArtworksForPlace, upsertEditorialDraft,
  visibleEditorialDrafts, decodeEditorialDrafts,
} from "../src/domain/editorial.ts";

const place = makePlace("Praça de teste");
const textArt = makeArtwork("text", "Poema", [0,0,-1]);
const cardArt = makeArtwork("card", "Cartão fictício", [0,0,-2]);
place.artworks.push(textArt, cardArt);

test("keeps source-defined Brasília collections distinct", () => {
  assert.deepEqual(COLLECTIONS.map((x) => x.id), ["memor-brasilia","brasilia-aberta"]);
  assert.equal(COLLECTIONS[0].retentionRule.includes("sem expiração automática"),true);
  assert.equal(COLLECTIONS[1].isWorkingName,true);
});

test("editorial filters never invent affiliation for unlinked art", () => {
  assert.equal(filterIncludes("all", null),true);
  assert.equal(filterIncludes("projects", null),false);
  assert.equal(filterIncludes("community", null),false);
  assert.equal(filterIncludes("projects","project"),true);
  assert.equal(filterIncludes("community","community"),true);
});

test("a QA card is not a real photograph suitable for publishing", () => {
  assert.deepEqual(editorialArtworksForPlace(place).map(a=>a.id),[textArt.id]);
  assert.throws(()=>upsertEditorialDraft([],place,cardArt.id,"memor-brasilia"),/não existe|fotografia real/);
});

test("draft saves one artwork association and replaces its prior destination", () => {
  const first=upsertEditorialDraft([],place,textArt.id,"memor-brasilia");
  assert.equal(first.length,1);
  const second=upsertEditorialDraft(first,place,textArt.id,"brasilia-aberta");
  assert.equal(second.length,1);
  assert.equal(second[0].destinationID,"brasilia-aberta");
  assert.equal(visibleEditorialDrafts(second,[place]).length,1);
  assert.equal(visibleEditorialDrafts(second,[]).length,0);
  assert.equal(visibleEditorialDrafts(second,[makePlace("Other")]).length,0);
});

test("unknown versions of local editorial data are rejected instead of reset", () => {
  assert.deepEqual(decodeEditorialDrafts(null),[]);
  assert.throws(()=>decodeEditorialDrafts('{"version":2,"drafts":[]}'),/outra versão/);
  assert.equal(decodeEditorialDrafts('{"version":1,"drafts":[]}').length,0);
});
