import { createEmbedding, createBatchEmbeddings } from "./embeddings.js";
import { getAllSkillManifests } from "@cairn/skills";

export interface RoutedSkill {
    skillId: string;
    score: number;
}

interface SkillVector {
    id: string;
    vector: number[];
}

let skillRegistryVectors: SkillVector[] = [];

/**
 * Pre-embeds all enabled skills using a rich descriptive string.
 * This should be called once during system startup.
 */
export async function indexSkillsForRouting(): Promise<void> {
    const manifests = getAllSkillManifests().filter(m => m.enabled);
    
    // Enrich the embedding string: ID + Description + Tags
    const enrichment = manifests.map(m => {
        return `Skill: ${m.id}. Description: ${m.description}. Keywords: ${(m.tags || []).join(", ")}.`;
    });

    const { embeddings } = await createBatchEmbeddings(enrichment);
    
    skillRegistryVectors = manifests.map((m, i) => ({
        id: m.id,
        vector: embeddings[i]
    }));

    console.log(`[semantic-router] Indexed ${skillRegistryVectors.length} skills`);
}

/**
 * Calculates cosine similarity between two vectors.
 */
function cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Finds the best skill match for a given user input via embedding similarity.
 */
export async function semanticRoute(userInput: string): Promise<RoutedSkill[]> {
    if (skillRegistryVectors.length === 0) {
        await indexSkillsForRouting();
    }

    const { embedding } = await createEmbedding(userInput);
    
    const results = skillRegistryVectors.map(sv => ({
        skillId: sv.id,
        score: cosineSimilarity(embedding, sv.vector)
    }));

    // Return top 3 sorted by score
    return results.sort((a, b) => b.score - a.score).slice(0, 3);
}
