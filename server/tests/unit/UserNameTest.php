<?php

use App\Libraries\UserName;
use CodeIgniter\Test\CIUnitTestCase;
use Config\Services;

/**
 * Unit tests for the display name rule: App\Libraries\UserName and the valid_user_name rule.
 *
 * @internal
 */
final class UserNameTest extends CIUnitTestCase
{
    public function testNormalizeTrimsCollapsesSpacesAndDropsInvisibleCharacters(): void
    {
        $this->assertSame('Иван Петров', UserName::normalize("  Иван \t\n Петров  "));
        $this->assertSame('Ян', UserName::normalize("Я\u{200B}н"));
        $this->assertSame('Ян Ли', UserName::normalize("Ян \u{200B} Ли"));
        $this->assertSame('', UserName::normalize(null));
    }

    public function testTwoLetterNamesAreValid(): void
    {
        $this->assertNull(UserName::error('Ян'));
        $this->assertNull(UserName::error('Li'));
        $this->assertNull(UserName::error('Анна-Мария О’Коннор'));
        $this->assertNull(UserName::error('Ivan Petrov (Vanya)'));
    }

    public function testTooShortNames(): void
    {
        $this->assertSame('nameTooShort', UserName::error(''));
        $this->assertSame('nameTooShort', UserName::error('.'));
        $this->assertSame('nameTooShort', UserName::error('Я'));
        $this->assertSame('nameTooShort', UserName::error('- _'));
    }

    public function testTooLongName(): void
    {
        $this->assertNull(UserName::error(str_repeat('я', 40)));
        $this->assertSame('nameTooLong', UserName::error(str_repeat('я', 41)));
    }

    public function testLinksEmailsAndSymbolsAreRefused(): void
    {
        $this->assertSame('nameInvalidChars', UserName::error('ivan@mail.ru'));
        $this->assertSame('nameInvalidChars', UserName::error('https://spam'));
        $this->assertSame('nameInvalidChars', UserName::error('Ivan 🌲'));
        $this->assertSame('nameInvalidChars', UserName::error('<b>Ivan</b>'));
    }

    public function testForNewUserKeepsAValidName(): void
    {
        $this->assertSame('Ян', UserName::forNewUser(' Ян ', 'ru'));
        $this->assertSame('Иван Петров', UserName::forNewUser('Иван  Петров', 'ru'));
    }

    public function testForNewUserAddsTheWordToAShortName(): void
    {
        $this->assertSame('Я Исследователь', UserName::forNewUser('Я', 'ru'));
        $this->assertSame('J Explorer', UserName::forNewUser('J', 'en'));
    }

    public function testForNewUserGivesTheWordForAnEmptyName(): void
    {
        $this->assertSame('Исследователь', UserName::forNewUser(null, 'ru'));
        $this->assertSame('Исследователь', UserName::forNewUser('.', 'ru'));
        $this->assertSame('Explorer', UserName::forNewUser('', 'en-US'));
        $this->assertSame('Исследователь', UserName::forNewUser(null, 'de'));
    }

    public function testForNewUserDropsSymbolsAndCutsALongNameAtAWord(): void
    {
        $this->assertSame('Ivan', UserName::forNewUser('🌲 Ivan 🌲', 'en'));

        $long = 'Александра Константиновна Преображенская-Римская';
        $name = UserName::forNewUser($long, 'ru');

        $this->assertSame('Александра Константиновна', $name);
        $this->assertTrue(UserName::isValid($name));
    }

    public function testValidationRuleExplainsTheError(): void
    {
        $validation = Services::validation();

        $this->assertTrue($validation->setRules(['name' => 'required|valid_user_name'])->run(['name' => 'Ян']));

        $validation->reset();
        $this->assertFalse($validation->setRules(['name' => 'required|valid_user_name'])->run(['name' => '.']));
        $this->assertSame(lang('Users.nameTooShort', [2, 40]), $validation->getError('name'));
    }
}
