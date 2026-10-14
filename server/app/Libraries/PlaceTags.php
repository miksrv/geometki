<?php namespace App\Libraries;

use App\Models\PlacesTagsModel;
use App\Models\TagsModel;
use Config\Services;
use ReflectionException;

class PlaceTags {

    private TagsModel $tagsModel;
    private PlacesTagsModel $placeTagsModel;

    public function __construct() {
        $this->tagsModel      = new TagsModel();
        $this->placeTagsModel = new PlacesTagsModel();
    }

    /**
     * @param array $tags
     * @param string $placeId
     * @return array
     * @throws ReflectionException
     */
    public function saveTags(array $tags, string $placeId): array {
        $locale     = Services::request()->getLocale();
        $updatedIds = [];
        $returnTags = [];

        if (!$placeId) {
            return $returnTags;
        }

        // First, delete all existing tags and decrease the counter of these tags
        $this->_deletePlaceTags($placeId);

        // If we just remove all tags
        if (empty($tags)) {
            return $returnTags;
        }

        foreach ($tags as $tag) {
            if (!$tagData = $this->tagsModel->getTagsByTitle($tag)) {
                // Add a new tag
                $this->tagsModel->insert(['title_' . $locale => $tag, 'count' => 1]);
                $this->placeTagsModel->insert([
                    'tag_id'   => $this->tagsModel->getInsertID(),
                    'place_id' => $placeId
                ]);

                $returnTags[] = $tag;

            } else {
                // We check that there are no identical IDs. This can happen if the same tag is added in two languages,
                // that is, the array of $tags tags comes as ['озеро', 'lake'] and both refer to the same tag in the database
                if (in_array($tagData->id, $updatedIds)) {
                    continue;
                }

                // In SQL, not read-modify-write: two places saved at once must both count
                $this->tagsModel->builder()->where('id', $tagData->id)
                    ->set('count', 'count + 1', false)
                    ->set('updated_at', 'NOW()', false)
                    ->update();
                $this->placeTagsModel->insert([
                    'tag_id'   => $tagData->id,
                    'place_id' => $placeId
                ]);

                $returnTags[] = $tag;
                $updatedIds[] = $tagData->id;
            }
        }

        return $returnTags;
    }

    /**
     * @throws ReflectionException
     */
    protected function _deletePlaceTags(string $placeId): void {
        if ($oldTagsData = $this->placeTagsModel->getPlaceTags($placeId)) {
            $this->placeTagsModel->deleteByPlaceId($placeId);

            foreach ($oldTagsData as $tag) {
                $this->tagsModel->builder()->where('id', $tag->id)
                    ->set('count', 'GREATEST(CAST(count AS SIGNED) - 1, 0)', false)
                    ->set('updated_at', 'NOW()', false)
                    ->update();
            }
        }
    }
}
