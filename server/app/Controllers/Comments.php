<?php

namespace App\Controllers;

use App\Entities\CommentEntity;
use App\Libraries\ActivityLibrary;
use App\Libraries\AvatarLibrary;
use App\Libraries\SessionLibrary;
use App\Models\CommentsModel;
use App\Models\PlacesModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Exception;
use ReflectionException;

class Comments extends ResourceController
{

    protected $model;

    private SessionLibrary $session;

    public function __construct()
    {
        $this->model   = new CommentsModel();
        $this->session = new SessionLibrary();
    }

    /**
     * @return ResponseInterface
     * @throws Exception
     */
    public function list(): ResponseInterface
    {
        $place = $this->request->getGet('place', FILTER_SANITIZE_SPECIAL_CHARS);
        $data  = $this->model
            ->select('comments.*, users.id as user_id, users.name as user_name, users.avatar as user_avatar')
            ->join('users', 'comments.user_id = users.id', 'left')
            ->where('place_id', $place)
            ->orderBy('created_at', 'DESC')
            ->findAll();

        if (empty($data)) {
            return $this->respond(['items' => [], 'count' => 0]);
        }

        $avatarLibrary = new AvatarLibrary();
        foreach ($data as $comment) {
            $comment->placeId  = $comment->place_id;
            $comment->answerId = $comment->answer_id;
            $comment->created  = $comment->created_at;
            $comment->author   = [
                'id'     => $comment->user_id,
                'name'   => $comment->user_name,
                'avatar' => $avatarLibrary->buildPath($comment->user_id, $comment->user_avatar, 'small'),
            ];

            unset(
                $comment->place_id, $comment->answer_id, $comment->user_id,
                $comment->user_name, $comment->user_avatar, $comment->created_at
            );
        }

        return $this->respond(['items' => $data, 'count' => count($data)]);
    }

    /**
     * @return ResponseInterface
     * @throws ReflectionException
     */
    public function create(): ResponseInterface
    {
        if (!$this->session->isAuth) {
            return $this->failUnauthorized();
        }

        $input = $this->request->getJSON();
        $rules = [
            'placeId'  => 'required|min_length[13]|max_length[13]',
            'answerId' => 'if_exist|required|min_length[13]|max_length[13]',
            'comment'  => 'required|string'
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id, user_id, comments, updated_at')->find($input->placeId);

        if (!$placesData) {
            return $this->failValidationErrors('Place with this ID does not exist');
        }

        $comment = new CommentEntity();
        $comment->place_id  = $placesData->id;
        $comment->user_id   = $this->session->user->id;
        $comment->answer_id = $input?->answerId ?? null;
        $comment->content   = strip_tags(html_entity_decode($input->comment));

        $newCommentId = $this->model->insert($comment);

        $activity = new ActivityLibrary();
        $activity->owner($placesData->user_id);
        $activity->comment($comment->place_id, $newCommentId);

        // Update the comments count
        $placesModel->update($placesData->id, [
            'comments'   => $placesData->comments + 1,
            'updated_at' => $placesData->updated_at
        ]);

        return $this->respondCreated();
    }
}