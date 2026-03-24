<?php

use App\Models\ApplicationBaseModel;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for ApplicationBaseModel::prepareOutput() and generateId().
 *
 * prepareOutput() is a CI4 afterFind callback — it receives a $data array
 * with keys 'data', 'method', and 'returnData'. We call it directly here,
 * bypassing any database requirement.
 *
 * generateId() is a CI4 beforeInsert callback — it injects an `id` key.
 *
 * @internal
 */
final class ApplicationBaseModelTest extends CIUnitTestCase
{
    /** @var ApplicationBaseModel Concrete (non-abstract) subclass instance */
    private ApplicationBaseModel $model;

    protected function setUp(): void
    {
        parent::setUp();

        // ApplicationBaseModel is not abstract, but it extends CI4 Model which
        // needs a db connection when it first tries to query. We instantiate via
        // an anonymous subclass that overrides $table to prevent auto-guessing.
        $this->model = new class extends ApplicationBaseModel {
            protected $table = 'example'; // matches the test support migration
        };
    }

    // =========================================================================
    // prepareOutput() — when hiddenFields is empty
    // =========================================================================

    public function testPrepareOutputWithNoHiddenFieldsReturnsSameData(): void
    {
        $data = [
            'data'       => [(object) ['id' => 1, 'name' => 'Alice']],
            'method'     => 'findAll',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        // hiddenFields is empty → original data returned unchanged
        $this->assertSame($data, $result);
    }

    public function testPrepareOutputWithEmptyDataReturnsOriginal(): void
    {
        $data = [
            'data'       => null,
            'method'     => 'findAll',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        $this->assertSame($data, $result);
    }

    // =========================================================================
    // prepareOutput() — with hidden fields configured
    // =========================================================================

    public function testPrepareOutputRemovesHiddenFieldFromFindAll(): void
    {
        // Inject hiddenFields via reflection
        $reflection = new ReflectionProperty(ApplicationBaseModel::class, 'hiddenFields');
        $reflection->setAccessible(true);
        $reflection->setValue($this->model, ['secret']);

        $row  = (object) ['id' => 1, 'name' => 'Alice', 'secret' => 'hidden'];
        $data = [
            'data'       => [$row],
            'method'     => 'findAll',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        $this->assertArrayHasKey('data', $result);
        $this->assertIsArray($result['data']);
        $this->assertObjectNotHasProperty('secret', $result['data'][0]);
        $this->assertObjectHasProperty('name', $result['data'][0]);
    }

    public function testPrepareOutputRemovesHiddenFieldFromFind(): void
    {
        $reflection = new ReflectionProperty(ApplicationBaseModel::class, 'hiddenFields');
        $reflection->setAccessible(true);
        $reflection->setValue($this->model, ['deleted_at']);

        $row  = (object) ['id' => 1, 'name' => 'Bob', 'deleted_at' => null];
        $data = [
            'data'       => $row,
            'method'     => 'find',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        // find() wraps row in array then unwraps — result['data'] is the single object
        $this->assertObjectNotHasProperty('deleted_at', $result['data']);
        $this->assertObjectHasProperty('name', $result['data']);
    }

    public function testPrepareOutputRemovesHiddenFieldFromFirst(): void
    {
        $reflection = new ReflectionProperty(ApplicationBaseModel::class, 'hiddenFields');
        $reflection->setAccessible(true);
        $reflection->setValue($this->model, ['password']);

        $row  = (object) ['id' => 2, 'email' => 'x@y.com', 'password' => 'hashed'];
        $data = [
            'data'       => $row,
            'method'     => 'first',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        $this->assertObjectNotHasProperty('password', $result['data']);
        $this->assertObjectHasProperty('email', $result['data']);
    }

    public function testPrepareOutputPreservesNonHiddenFields(): void
    {
        $reflection = new ReflectionProperty(ApplicationBaseModel::class, 'hiddenFields');
        $reflection->setAccessible(true);
        $reflection->setValue($this->model, ['token']);

        $row  = (object) ['id' => 3, 'title' => 'Test', 'token' => 'abc'];
        $data = [
            'data'       => [$row],
            'method'     => 'findAll',
            'returnData' => true,
        ];

        $result = $this->model->prepareOutput($data);

        $this->assertObjectHasProperty('id',    $result['data'][0]);
        $this->assertObjectHasProperty('title', $result['data'][0]);
    }

    // =========================================================================
    // generateId() — beforeInsert callback
    // =========================================================================

    public function testGenerateIdInjectsIdKey(): void
    {
        $reflection = new ReflectionMethod(ApplicationBaseModel::class, 'generateId');
        $reflection->setAccessible(true);

        $data   = ['data' => ['name' => 'Alice']];
        $result = $reflection->invoke($this->model, $data);

        $this->assertArrayHasKey('id', $result['data']);
    }

    public function testGenerateIdReturnsNonEmptyString(): void
    {
        $reflection = new ReflectionMethod(ApplicationBaseModel::class, 'generateId');
        $reflection->setAccessible(true);

        $data   = ['data' => ['name' => 'Test']];
        $result = $reflection->invoke($this->model, $data);

        $this->assertIsString($result['data']['id']);
        $this->assertNotEmpty($result['data']['id']);
    }

    public function testGenerateIdProducesDifferentIdsOnEachCall(): void
    {
        $reflection = new ReflectionMethod(ApplicationBaseModel::class, 'generateId');
        $reflection->setAccessible(true);

        $data1 = $reflection->invoke($this->model, ['data' => []]);
        $data2 = $reflection->invoke($this->model, ['data' => []]);

        $this->assertNotSame($data1['data']['id'], $data2['data']['id']);
    }

    public function testGenerateIdDoesNotOverwriteExistingId(): void
    {
        $reflection = new ReflectionMethod(ApplicationBaseModel::class, 'generateId');
        $reflection->setAccessible(true);

        $existingId = 'existing123';
        $data       = ['data' => ['id' => $existingId, 'name' => 'Test']];
        $result     = $reflection->invoke($this->model, $data);

        $this->assertSame($existingId, $result['data']['id']);
        $this->assertSame($existingId, $this->model->getLastGeneratedId());
    }

    public function testGetLastGeneratedIdReturnsNullInitially(): void
    {
        $this->assertNull($this->model->getLastGeneratedId());
    }

    public function testGetLastGeneratedIdReturnsIdAfterGenerateId(): void
    {
        $reflection = new ReflectionMethod(ApplicationBaseModel::class, 'generateId');
        $reflection->setAccessible(true);

        $data   = ['data' => ['name' => 'Test']];
        $result = $reflection->invoke($this->model, $data);

        $this->assertSame($result['data']['id'], $this->model->getLastGeneratedId());
    }

    // =========================================================================
    // createId() — public method to generate ID before insert
    // =========================================================================

    public function testCreateIdReturnsNonEmptyString(): void
    {
        $id = $this->model->createId();

        $this->assertIsString($id);
        $this->assertNotEmpty($id);
    }

    public function testCreateIdUpdatesLastGeneratedId(): void
    {
        $id = $this->model->createId();

        $this->assertSame($id, $this->model->getLastGeneratedId());
    }

    public function testCreateIdProducesDifferentIdsOnEachCall(): void
    {
        $id1 = $this->model->createId();
        $id2 = $this->model->createId();

        $this->assertNotSame($id1, $id2);
    }
}
