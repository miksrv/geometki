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
use ReflectionException;
use Throwable;

/**
 * Comments controller
 *
 * Manages user comments on places including listing and creation.
 * Comment creation requires authentication and updates the place comment counter
 * inside a database transaction.
 *
 * @package App\Controllers
 */
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
     * Return all comments for a given place, newest first.
     *
     * GET /comments?place=:id
     *
     * @return ResponseInterface
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
     * Post a new comment on a place.
     *
     * POST /comments — auth required.
     * Expects JSON body with placeId, comment, and optional answerId.
     * Increments the place comment counter inside a transaction and records activity.
     *
     * @throws ReflectionException
     *
     * @return ResponseInterface
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
            'comment'  => 'required|string|max_length[2000]'
        ];

        if (!$this->validateData((array) $input, $rules)) {
            return $this->failValidationErrors($this->validator->getErrors());
        }

        $placesModel = new PlacesModel();
        $placesData  = $placesModel->select('id, user_id, comments, updated_at')->find($input->placeId);

        if (!$placesData) {
            return $this->failValidationErrors(lang('Comments.placeNotFound'));
        }

        try {
            $comment = new CommentEntity();
            $comment->place_id  = $placesData->id;
            $comment->user_id   = $this->session->user->id;
            $comment->answer_id = $input?->answerId ?? null;
            $comment->content   = strip_tags(html_entity_decode($input->comment));

            $db = \Config\Database::connect();
            $db->transStart();

            $newCommentId = $this->model->insert($comment);

            // Update the comments count
            $placesModel->update($placesData->id, [
                'comments'   => $placesData->comments + 1,
                'updated_at' => $placesData->updated_at
            ]);

            $db->transComplete();

            $activity = new ActivityLibrary();
            $activity->owner($placesData->user_id);
            $activity->comment($comment->place_id, $newCommentId);

            return $this->respondCreated();
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('Comments.createError'));
        }
    }
}